import type { VercelRequest, VercelResponse } from '@vercel/node'

type StaffContact = {
  id: string
  name: string
  title: string
  email: string
  phone?: string
  department?: string
  sourceUrl: string
}
function cleanHtmlText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeDuckDuckGoUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl, 'https://html.duckduckgo.com')
    const redirect = url.searchParams.get('uddg')
    return redirect ? decodeURIComponent(redirect) : url.toString()
  } catch {
    return rawUrl
  }
}

function parseSearchResults(html: string) {
  const matches = [...html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  return matches.map(match => ({
    url: decodeDuckDuckGoUrl(match[1]),
    title: cleanHtmlText(match[2]),
  }))
}

function extractContactsFromRows(html: string, sourceUrl: string) {
  const contacts: StaffContact[] = []
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]

  for (const row of rows) {
    if (!/mailto:/i.test(row[1])) continue
    const emailMatch = row[1].match(/mailto:([^"'?#\s>]+)/i)
    if (!emailMatch) continue
    const email = emailMatch[1].trim().toLowerCase()
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => cleanHtmlText(cell[1]))
    const filtered = cells.filter(Boolean)
    const name = filtered.find(value => !value.includes('@') && /^[A-Z][A-Za-z.' -]+$/.test(value)) ?? filtered[0] ?? ''
    const title = filtered.find(value => value !== name && value !== email && !/\(?\d{3}\)?/.test(value)) ?? ''
    const phone = filtered.find(value => /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(value))
    if (!name || !email) continue
    contacts.push({
      id: email,
      name,
      title: title || 'Staff contact',
      email,
      phone,
      sourceUrl,
    })
  }

  return contacts
}

function extractContactsFromMailto(html: string, sourceUrl: string) {
  const contacts: StaffContact[] = []
  const matches = [...html.matchAll(/<a[^>]+href=["']mailto:([^"'?#\s>]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)]

  for (const match of matches) {
    const email = match[1].trim().toLowerCase()
    const anchorText = cleanHtmlText(match[2])
    const start = Math.max(0, match.index - 220)
    const end = Math.min(html.length, match.index + match[0].length + 220)
    const context = cleanHtmlText(html.slice(start, end))
    const name = anchorText && !anchorText.includes('@')
      ? anchorText
      : (context.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,2})/)?.[1] ?? '')
    const title = context.match(/(Town Clerk|Assistant Town Clerk|Town Administrator|Finance Director|Accountant|Building Commissioner|Records Access Officer|Planning Director|Human Resources Director|Procurement Officer|Director of Public Works|Health Director|Treasurer|Collector)/i)?.[1] ?? 'Staff contact'
    const phone = context.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/)?.[1]
    if (!name) continue
    contacts.push({
      id: email,
      name,
      title,
      email,
      phone,
      sourceUrl,
    })
  }

  return contacts
}

function dedupeContacts(contacts: StaffContact[]) {
  return contacts.filter((contact, index, items) => items.findIndex(candidate => candidate.email === contact.email) === index)
}

async function searchDirectoryPages(town: string) {
  const queries = [
    `${town} Massachusetts CivicPlus staff directory`,
    `${town} Massachusetts town hall staff directory`,
    `${town} Massachusetts official site departments directory`,
  ]

  // Run all three searches in parallel, 6s each
  const htmlResults = await Promise.allSettled(
    queries.map(q =>
      fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PublicLogic/1.0)', 'Accept': 'text/html' },
        signal: AbortSignal.timeout(6_000),
      }).then(r => r.ok ? r.text() : '')
    )
  )

  const results: Array<{ url: string; title: string }> = []
  for (const r of htmlResults) {
    if (r.status === 'fulfilled' && r.value) results.push(...parseSearchResults(r.value))
  }

  return results
    .filter(r => /^https?:\/\//i.test(r.url))
    .sort((a, b) => {
      const score = (v: string) => {
        let t = 0
        if (/civicplus/i.test(v)) t += 4
        if (/staff|directory|department|contact/i.test(v)) t += 3
        if (/massachusetts|ma\b|town/i.test(v)) t += 2
        return t
      }
      return score(b.url + b.title) - score(a.url + a.title)
    })
    .filter((r, i, arr) => arr.findIndex(c => c.url === r.url) === i)
    .slice(0, 5)
}

export const config = { maxDuration: 30 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const town = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  if (!town) return res.status(400).json({ error: 'Town name is required' })

  try {
    const pages = await searchDirectoryPages(town)

    // Fetch all pages in parallel, 8s each
    const pageResults = await Promise.allSettled(
      pages.map(page =>
        fetch(page.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PublicLogic/1.0)', 'Accept': 'text/html,application/xhtml+xml' },
          signal: AbortSignal.timeout(8_000),
        }).then(r => r.ok ? r.text().then(html => ({ html, url: page.url })) : null)
      )
    )

    const collected: StaffContact[] = []
    for (const r of pageResults) {
      if (r.status !== 'fulfilled' || !r.value) continue
      const { html, url } = r.value
      collected.push(...extractContactsFromRows(html, url))
      if (collected.length < 6) collected.push(...extractContactsFromMailto(html, url))
    }

    const employees = dedupeContacts(collected).slice(0, 20)

    return res.status(200).json({
      town,
      employees,
      sourcePages: pages.map(p => p.url),
      notice: employees.length > 0
        ? 'Pulled from public staff-directory pages.'
        : 'No public staff contacts found. Import a CSV or add staff manually.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
}
