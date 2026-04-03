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

async function searchDirectoryPages(
  town: string
): Promise<Array<{ url: string; title: string }>> {
  const queries = [
    `${town} Massachusetts CivicPlus staff directory`,
    `${town} Massachusetts town hall staff directory`,
    `${town} Massachusetts official site departments directory`,
  ];

  const results: Array<{ url: string; title: string }> = [];

  for (const query of queries) {
    try {
      const res = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            "User-Agent": "PublicLogic/StaffLookup (+https://publiclogic.org)",
            Accept: "text/html",
          },
          signal: AbortSignal.timeout(12_000),
        }
      );
      if (!res.ok) continue;
      const html = await res.text();
      results.push(...parseSearchResults(html));
    } catch {
      continue;
    }
  }

  return results
    .filter((result) => /^https?:\/\//i.test(result.url))
    .sort((a, b) => {
      const score = (value: string) => {
        let total = 0;
        if (/civicplus/i.test(value)) total += 4;
        if (/staff|directory|department|contact/i.test(value)) total += 3;
        if (/massachusetts|ma\b|town/i.test(value)) total += 2;
        return total;
      };
      return score(b.url + b.title) - score(a.url + a.title);
    })
    .filter(
      (result, index, items) =>
        items.findIndex((candidate) => candidate.url === result.url) === index
    )
    .slice(0, 4);
}

export async function scrapeStaff(townName: string): Promise<ScrapeResult> {
  try {
    const pages = await searchDirectoryPages(townName);
    const collected: StaffEmployee[] = [];

    for (const page of pages) {
      try {
        const response = await fetch(page.url, {
          headers: {
            "User-Agent": "PublicLogic/StaffLookup (+https://publiclogic.org)",
            Accept: "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) continue;
        const html = await response.text();
        collected.push(...extractContactsFromRows(html, page.url));
        if (collected.length < 6) {
          collected.push(...extractContactsFromMailto(html, page.url));
        }
        if (collected.length >= 8) break;
      } catch {
        continue;
      }
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
