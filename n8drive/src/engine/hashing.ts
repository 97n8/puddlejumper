import crypto from "node:crypto";

export function canonicalize(input: unknown): string {
  if (Array.isArray(input)) {
    return `[${input.map(canonicalize).join(",")}]`;
  }

  if (input !== null && typeof input === "object") {
    const objectInput = input as Record<string, unknown>;
    const keys = Object.keys(objectInput).sort();
    const parts = keys.map((key) => `${JSON.stringify(key)}:${canonicalize(objectInput[key])}`);
    return `{${parts.join(",")}}`;
  }

  return JSON.stringify(input);
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}
