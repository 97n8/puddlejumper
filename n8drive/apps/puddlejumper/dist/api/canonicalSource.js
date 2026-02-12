import { resolve4 as dnsResolve4, resolve6 as dnsResolve6 } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
export const DEFAULT_CANONICAL_ALLOWED_HOSTS = ["raw.githubusercontent.com", "github.com"];
const PRIVATE_ADDRESS_BLOCKLIST = new BlockList();
PRIVATE_ADDRESS_BLOCKLIST.addSubnet("127.0.0.0", 8, "ipv4");
PRIVATE_ADDRESS_BLOCKLIST.addSubnet("10.0.0.0", 8, "ipv4");
PRIVATE_ADDRESS_BLOCKLIST.addSubnet("172.16.0.0", 12, "ipv4");
PRIVATE_ADDRESS_BLOCKLIST.addSubnet("192.168.0.0", 16, "ipv4");
PRIVATE_ADDRESS_BLOCKLIST.addSubnet("169.254.0.0", 16, "ipv4");
PRIVATE_ADDRESS_BLOCKLIST.addAddress("169.254.169.254", "ipv4");
PRIVATE_ADDRESS_BLOCKLIST.addAddress("::1", "ipv6");
PRIVATE_ADDRESS_BLOCKLIST.addSubnet("fc00::", 7, "ipv6");
export class CanonicalSourceError extends Error {
    status;
    details;
    constructor(status, message, details = {}) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
function normalizeHost(value) {
    return value.trim().toLowerCase().replace(/\.$/, "");
}
function isPrivateAddress(ipAddress) {
    const family = isIP(ipAddress);
    if (family === 4) {
        return PRIVATE_ADDRESS_BLOCKLIST.check(ipAddress, "ipv4");
    }
    if (family === 6) {
        return PRIVATE_ADDRESS_BLOCKLIST.check(ipAddress, "ipv6");
    }
    return true;
}
async function resolveAddresses(hostname, resolve4, resolve6) {
    if (isIP(hostname)) {
        return [hostname];
    }
    const [v4Result, v6Result] = await Promise.allSettled([resolve4(hostname), resolve6(hostname)]);
    const addresses = [];
    if (v4Result.status === "fulfilled") {
        addresses.push(...v4Result.value);
    }
    if (v6Result.status === "fulfilled") {
        addresses.push(...v6Result.value);
    }
    return Array.from(new Set(addresses.map((address) => address.trim()).filter(Boolean)));
}
async function readBodyWithLimit(response, maxBytes) {
    if (!response.body) {
        const text = await response.text();
        if (Buffer.byteLength(text, "utf8") > maxBytes) {
            throw new CanonicalSourceError(400, "Invalid canonical source.", { reason: "canonical_too_large" });
        }
        return text;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        const chunk = value ?? new Uint8Array();
        totalBytes += chunk.byteLength;
        if (totalBytes > maxBytes) {
            await reader.cancel();
            throw new CanonicalSourceError(400, "Invalid canonical source.", { reason: "canonical_too_large" });
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}
export async function fetchCanonicalJsonDocument(canonicalUrl, options) {
    const timeoutMs = options.timeoutMs ?? 3000;
    const maxBytes = options.maxBytes ?? 1_048_576;
    const resolve4 = options.resolve4 ?? dnsResolve4;
    const resolve6 = options.resolve6 ?? dnsResolve6;
    const fetchImpl = options.fetchImpl ?? fetch;
    const allowedHosts = Array.from(new Set(options.allowedHosts.map(normalizeHost).filter(Boolean)));
    let parsedUrl;
    try {
        parsedUrl = new URL(canonicalUrl);
    }
    catch {
        throw new CanonicalSourceError(400, "Invalid canonical source.", { reason: "invalid_url" });
    }
    if (parsedUrl.protocol !== "https:") {
        throw new CanonicalSourceError(400, "Invalid canonical source.", { reason: "invalid_protocol" });
    }
    const hostname = normalizeHost(parsedUrl.hostname);
    if (!allowedHosts.includes(hostname)) {
        throw new CanonicalSourceError(400, "Invalid canonical source.", { reason: "host_not_allowed", host: hostname });
    }
    const addresses = await resolveAddresses(hostname, resolve4, resolve6);
    if (addresses.length === 0) {
        throw new CanonicalSourceError(400, "Invalid canonical source.", { reason: "dns_resolution_failed", host: hostname });
    }
    if (addresses.some((address) => isPrivateAddress(address))) {
        throw new CanonicalSourceError(400, "Invalid canonical source.", { reason: "private_address", host: hostname });
    }
    let response;
    try {
        response = await fetchImpl(parsedUrl.toString(), {
            method: "GET",
            redirect: "error",
            signal: AbortSignal.timeout(timeoutMs),
            headers: {
                Accept: "application/json"
            }
        });
    }
    catch {
        throw new CanonicalSourceError(409, "Plan integrity check failed: canonical source unavailable.", {
            canonicalUrl: parsedUrl.toString()
        });
    }
    if (!response.ok) {
        throw new CanonicalSourceError(409, "Plan integrity check failed: canonical source unavailable.", {
            canonicalUrl: parsedUrl.toString(),
            status: response.status
        });
    }
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("application/json")) {
        throw new CanonicalSourceError(400, "Invalid canonical source.", { reason: "invalid_content_type", contentType });
    }
    return readBodyWithLimit(response, maxBytes);
}
