/**
 * Town staff scraper — ported from LogicOS api/civic/staff.ts.
 * Uses DuckDuckGo to find public staff directory pages and extracts contacts.
 */

export interface StaffEmployee {
  name: string;
  title: string;
  email: string;
  phone?: string;
  sourceUrl: string;
}

export interface ScrapeResult {
  employees: StaffEmployee[];
  sourcePages: string[];
  notice: string;
}

function cleanHtmlText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeDuckDuckGoUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, "https://html.duckduckgo.com");
    const redirect = url.searchParams.get("uddg");
    return redirect ? decodeURIComponent(redirect) : url.toString();
  } catch {
    return rawUrl;
  }
}

function parseSearchResults(html: string): Array<{ url: string; title: string }> {
  const matches = [
    ...html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi),
  ];
  return matches.map((match) => ({
    url: decodeDuckDuckGoUrl(match[1]),
    title: cleanHtmlText(match[2]),
  }));
}

function extractContactsFromRows(html: string, sourceUrl: string): StaffEmployee[] {
  const contacts: StaffEmployee[] = [];
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const row of rows) {
    if (!/mailto:/i.test(row[1])) continue;
    const emailMatch = row[1].match(/mailto:([^"'?#\s>]+)/i);
    if (!emailMatch) continue;
    const email = emailMatch[1].trim().toLowerCase();
    const cells = [
      ...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi),
    ].map((cell) => cleanHtmlText(cell[1]));
    const filtered = cells.filter(Boolean);
    const name =
      filtered.find(
        (value) =>
          !value.includes("@") && /^[A-Z][A-Za-z.' -]+$/.test(value)
      ) ??
      filtered[0] ??
      "";
    const title =
      filtered.find(
        (value) =>
          value !== name && value !== email && !/\(?\d{3}\)?/.test(value)
      ) ?? "";
    const phone = filtered.find((value) =>
      /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(value)
    );
    if (!name || !email) continue;
    contacts.push({ name, title: title || "Staff contact", email, phone, sourceUrl });
  }

  return contacts;
}

function extractContactsFromMailto(html: string, sourceUrl: string): StaffEmployee[] {
  const contacts: StaffEmployee[] = [];
  const matches = [
    ...html.matchAll(
      /<a[^>]+href=["']mailto:([^"'?#\s>]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi
    ),
  ];

  for (const match of matches) {
    const email = match[1].trim().toLowerCase();
    const anchorText = cleanHtmlText(match[2]);
    const start = Math.max(0, (match.index ?? 0) - 220);
    const end = Math.min(html.length, (match.index ?? 0) + match[0].length + 220);
    const context = cleanHtmlText(html.slice(start, end));
    const name =
      anchorText && !anchorText.includes("@")
        ? anchorText
        : context.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,2})/)?.[1] ?? "";
    const title =
      context.match(
        /(Town Clerk|Assistant Town Clerk|Town Administrator|Finance Director|Accountant|Building Commissioner|Records Access Officer|Planning Director|Human Resources Director|Procurement Officer|Director of Public Works|Health Director|Treasurer|Collector)/i
      )?.[1] ?? "Staff contact";
    const phone = context.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/)?.[1];
    if (!name) continue;
    contacts.push({ name, title, email, phone, sourceUrl });
  }

  return contacts;
}

function dedupeContacts(contacts: StaffEmployee[]): StaffEmployee[] {
  return contacts.filter(
    (contact, index, items) =>
      items.findIndex((candidate) => candidate.email === contact.email) === index
  );
}

/**
 * Generate candidate URLs for a MA town's staff/contact directory.
 * Many MA towns follow predictable CMS patterns — try them before falling
 * back to a search engine.
 */
function candidateUrls(town: string): Array<{ url: string; title: string }> {
  const slug = town.toLowerCase().replace(/\s+/g, "");
  const slugHyphen = town.toLowerCase().replace(/\s+/g, "-");
  const slugUnder = town.toLowerCase().replace(/\s+/g, "_");

  return [
    // CivicEngage / CivicPlus patterns (most common MA town CMS)
    { url: `https://${slug}ma.gov/government/staff-directory`, title: `${town} Staff Directory` },
    { url: `https://${slug}ma.gov/directory.aspx`, title: `${town} Directory` },
    { url: `https://${slug}ma.gov/Department/index.php`, title: `${town} Departments` },
    { url: `https://www.${slug}ma.gov/departments`, title: `${town} Departments` },
    { url: `https://www.${slug}ma.gov/government/town-officials`, title: `${town} Town Officials` },

    // CivicPlus hosted
    { url: `https://${slugHyphen}-ma.civicplus.com/directory.aspx`, title: `${town} CivicPlus Directory` },
    { url: `https://${slug}ma.civicplus.com/directory.aspx`, title: `${town} CivicPlus Directory` },

    // Generic MA town patterns
    { url: `https://www.townof${slug}.com/departments`, title: `Town of ${town} Departments` },
    { url: `https://www.townof${slug}.org/departments`, title: `Town of ${town} Departments` },
    { url: `https://${slug}.ma.us/departments`, title: `${town} MA Departments` },
    { url: `https://${slugHyphen}.ma.us/officials`, title: `${town} Officials` },
    { url: `https://www.${slugUnder}ma.gov/staff`, title: `${town} Staff` },
  ];
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function searchDirectoryPages(
  town: string
): Promise<Array<{ url: string; title: string }>> {
  // First try known URL patterns (no search engine needed)
  const candidates = candidateUrls(town);
  const working: Array<{ url: string; title: string }> = [];

  for (const c of candidates.slice(0, 6)) {
    try {
      const res = await fetch(c.url, {
        method: "HEAD",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        },
        signal: AbortSignal.timeout(6_000),
        redirect: "follow",
      });
      if (res.ok && res.headers.get("content-type")?.includes("html")) {
        working.push(c);
        if (working.length >= 2) break;
      }
    } catch {
      // continue
    }
  }

  if (working.length > 0) return working;

  // Fall back to a single targeted DuckDuckGo search
  const query = `"${town}" Massachusetts "town hall" (staff OR directory OR officials) site:.gov OR site:.us OR site:civicplus.com`;
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(12_000),
      }
    );
    if (res.ok) {
      const html = await res.text();
      const results = parseSearchResults(html)
        .filter((r) => {
          // Must include the town name and be a gov/us/civicplus domain
          const url = r.url.toLowerCase();
          const townSlug = town.toLowerCase().replace(/\s+/g, "");
          return (
            url.includes(townSlug) &&
            (/\.gov|\.us|civicplus\.com|\.ma\.us/i.test(url))
          );
        })
        .slice(0, 3);
      return results;
    }
  } catch {
    // search failed — return empty
  }

  return [];
}

export async function scrapeStaff(townName: string): Promise<ScrapeResult> {
  try {
    const pages = await searchDirectoryPages(townName);
    const collected: StaffEmployee[] = [];

    for (const page of pages) {
      const html = await fetchPage(page.url);
      if (!html) continue;
      collected.push(...extractContactsFromRows(html, page.url));
      collected.push(...extractContactsFromMailto(html, page.url));
      if (collected.length >= 8) break;
    }

    const employees = dedupeContacts(collected).slice(0, 8);

    return {
      employees,
      sourcePages: pages.map((p) => p.url),
      notice:
        employees.length > 0
          ? "Pulled from public staff-directory pages when available."
          : "No public staff-directory contacts were parsed for this town yet. You can still assign workflow owners manually.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      employees: [],
      sourcePages: [],
      notice: `Staff scrape failed: ${message}`,
    };
  }
}
