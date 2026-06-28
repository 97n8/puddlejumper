import type { Recipe } from '../types'

export const recipesUtil: Recipe[] = [
  {
    id: 'util-password', name: 'Generate a strong password',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'length', label: 'Length', placeholder: '24', type: 'number' },
      { key: 'symbols', label: 'Include symbols? (yes/no)', placeholder: 'yes' },
    ],
    run: async (cfg) => {
      const len = parseInt(cfg.length || '24', 10)
      const syms = cfg.symbols?.toLowerCase() !== 'no'
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' + (syms ? '!@#$%^&*()-_=+[]{}|;:,.<>?' : '')
      const arr = crypto.getRandomValues(new Uint32Array(len))
      const pwd = Array.from(arr).map(n => chars[n % chars.length]).join('')
      await navigator.clipboard.writeText(pwd)
      return `Copied: ${pwd}`
    },
  },

  {
    id: 'util-uuids', name: 'Generate a batch of UUIDs',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'count', label: 'How many?', placeholder: '10', type: 'number' },
    ],
    run: async (cfg) => {
      const n = Math.min(parseInt(cfg.count || '10', 10), 100)
      const ids = Array.from({ length: n }, () => crypto.randomUUID())
      await navigator.clipboard.writeText(ids.join('\n'))
      return `${n} UUIDs copied to clipboard`
    },
  },

  {
    id: 'util-hash', name: 'SHA-256 hash any text',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Text to hash', placeholder: 'Paste anything…', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cfg.text))
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
      await navigator.clipboard.writeText(hex)
      return `Hash copied: ${hex.slice(0, 16)}…`
    },
  },

  {
    id: 'util-json-format', name: 'Format / prettify JSON',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'json', label: 'Paste JSON', placeholder: '{"key":"value"}', required: true, type: 'textarea' },
      { key: 'indent', label: 'Indent size', placeholder: '2', type: 'number' },
    ],
    run: async (cfg) => {
      const indent = parseInt(cfg.indent || '2', 10)
      const pretty = JSON.stringify(JSON.parse(cfg.json), null, indent)
      await navigator.clipboard.writeText(pretty)
      return `Formatted JSON copied (${pretty.split('\n').length} lines)`
    },
  },

  {
    id: 'util-json-to-csv', name: 'Convert JSON array → CSV',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'json', label: 'JSON array', placeholder: '[{"name":"Alice","age":30}]', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const data = JSON.parse(cfg.json) as Record<string, unknown>[]
      if (!Array.isArray(data) || data.length === 0) throw new Error('Must be a non-empty JSON array')
      const keys = Object.keys(data[0])
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const csv = [keys.join(','), ...data.map(row => keys.map(k => esc(row[k])).join(','))].join('\n')
      await navigator.clipboard.writeText(csv)
      return `CSV copied — ${data.length} rows × ${keys.length} columns`
    },
  },

  {
    id: 'util-csv-to-json', name: 'Convert CSV → JSON array',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'csv', label: 'Paste CSV', placeholder: 'name,age\nAlice,30', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const lines = cfg.csv.trim().split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
      })
      const json = JSON.stringify(rows, null, 2)
      await navigator.clipboard.writeText(json)
      return `JSON copied — ${rows.length} objects`
    },
  },

  {
    id: 'util-base64-encode', name: 'Base64 encode text',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Text to encode', placeholder: 'Paste anything…', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const encoded = btoa(unescape(encodeURIComponent(cfg.text)))
      await navigator.clipboard.writeText(encoded)
      return `Encoded (${encoded.length} chars) copied`
    },
  },

  {
    id: 'util-base64-decode', name: 'Base64 decode',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'encoded', label: 'Base64 to decode', placeholder: 'SGVsbG8gd29ybGQ=', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const decoded = decodeURIComponent(escape(atob(cfg.encoded.trim())))
      await navigator.clipboard.writeText(decoded)
      return `Decoded (${decoded.length} chars) copied`
    },
  },

  {
    id: 'util-sort-lines', name: 'Sort lines alphabetically',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Lines to sort', placeholder: 'One item per line…', required: true, type: 'textarea' },
      { key: 'reverse', label: 'Reverse order? (yes/no)', placeholder: 'no' },
      { key: 'dedupe', label: 'Remove duplicates? (yes/no)', placeholder: 'no' },
    ],
    run: async (cfg) => {
      let lines = cfg.text.split('\n').map(l => l.trim()).filter(Boolean)
      if (cfg.dedupe?.toLowerCase() === 'yes') lines = [...new Set(lines)]
      lines.sort((a, b) => a.localeCompare(b))
      if (cfg.reverse?.toLowerCase() === 'yes') lines.reverse()
      await navigator.clipboard.writeText(lines.join('\n'))
      return `${lines.length} lines sorted and copied`
    },
  },

  {
    id: 'util-dedupe', name: 'Remove duplicate lines',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Text with duplicates', placeholder: 'One item per line…', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const lines = cfg.text.split('\n')
      const unique = [...new Set(lines.map(l => l.trim()).filter(Boolean))]
      await navigator.clipboard.writeText(unique.join('\n'))
      return `Removed ${lines.length - unique.length} duplicates → ${unique.length} unique lines`
    },
  },

  {
    id: 'util-extract-emails', name: 'Extract email addresses from text',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Paste any text', placeholder: 'Paste an email thread, document, CSV…', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const emails = [...new Set(cfg.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [])]
      if (emails.length === 0) throw new Error('No email addresses found')
      await navigator.clipboard.writeText(emails.join('\n'))
      return `${emails.length} unique emails copied`
    },
  },

  {
    id: 'util-extract-urls', name: 'Extract all URLs from text',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Paste any text', placeholder: 'Paste HTML, markdown, email…', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const urls = [...new Set(cfg.text.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? [])]
      if (urls.length === 0) throw new Error('No URLs found')
      await navigator.clipboard.writeText(urls.join('\n'))
      return `${urls.length} unique URLs copied`
    },
  },

  {
    id: 'util-word-count', name: 'Count words, lines & characters',
    trigger: 'You click Go', triggerType: 'manual', action: 'Show stats', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Text to analyse', placeholder: 'Paste anything…', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const words = cfg.text.trim().split(/\s+/).filter(Boolean).length
      const lines = cfg.text.split('\n').length
      const chars = cfg.text.length
      const noSpaces = cfg.text.replace(/\s/g, '').length
      return `${words.toLocaleString()} words · ${lines.toLocaleString()} lines · ${chars.toLocaleString()} chars (${noSpaces.toLocaleString()} no spaces)`
    },
  },

  {
    id: 'util-regex-extract', name: 'Extract text with a regex',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Text to search', placeholder: 'Paste your content…', required: true, type: 'textarea' },
      { key: 'pattern', label: 'Regex pattern', placeholder: '\\d{3}-\\d{4}', required: true },
      { key: 'flags', label: 'Flags', placeholder: 'gi' },
    ],
    run: async (cfg) => {
      const re = new RegExp(cfg.pattern, cfg.flags || 'g')
      const matches = [...new Set(cfg.text.match(re) ?? [])]
      if (matches.length === 0) throw new Error('No matches found')
      await navigator.clipboard.writeText(matches.join('\n'))
      return `${matches.length} unique matches copied`
    },
  },

  {
    id: 'util-timestamp', name: 'Convert timestamp ↔ human date',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'value', label: 'Unix timestamp or ISO date', placeholder: '1709150400  or  2024-02-28T22:00:00Z', required: true },
    ],
    run: async (cfg) => {
      const v = cfg.value.trim()
      let result: string
      if (/^\d+$/.test(v)) {
        const ms = v.length <= 10 ? parseInt(v) * 1000 : parseInt(v)
        const d = new Date(ms)
        result = `${d.toISOString()}  (${d.toLocaleString()})`
      } else {
        const ts = Math.floor(new Date(v).getTime() / 1000)
        if (isNaN(ts)) throw new Error('Could not parse date')
        result = `${ts}  (${ts * 1000} ms)`
      }
      await navigator.clipboard.writeText(result)
      return result
    },
  },

  {
    id: 'util-gitignore', name: 'Generate .gitignore for any stack',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'stack', label: 'Language / framework', placeholder: 'node, python, react, go, rust, java, swift…', required: true },
    ],
    run: async (cfg) => {
      const res = await fetch(`https://www.toptal.com/developers/gitignore/api/${encodeURIComponent(cfg.stack)}`)
      if (!res.ok) throw new Error('Could not fetch gitignore')
      const text = await res.text()
      await navigator.clipboard.writeText(text)
      const lines = text.split('\n').filter(l => l && !l.startsWith('#')).length
      return `.gitignore copied — ${lines} rules for ${cfg.stack}`
    },
  },

  {
    id: 'util-url-encode', name: 'URL encode / decode',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Text to process', placeholder: 'hello world / hello%20world', required: true, type: 'textarea' },
      { key: 'mode', label: 'encode or decode', placeholder: 'encode' },
    ],
    run: async (cfg) => {
      const mode = cfg.mode?.toLowerCase().trim() || 'encode'
      const result = mode === 'decode' ? decodeURIComponent(cfg.text) : encodeURIComponent(cfg.text)
      await navigator.clipboard.writeText(result)
      return `${mode === 'decode' ? 'Decoded' : 'Encoded'} (${result.length} chars) copied`
    },
  },

  {
    id: 'util-find-replace', name: 'Find & replace in text',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Text', placeholder: 'Paste your content…', required: true, type: 'textarea' },
      { key: 'find', label: 'Find (regex ok)', placeholder: 'foo', required: true },
      { key: 'replace', label: 'Replace with', placeholder: 'bar' },
      { key: 'flags', label: 'Flags', placeholder: 'gi' },
    ],
    run: async (cfg) => {
      const re = new RegExp(cfg.find, cfg.flags || 'g')
      const result = cfg.text.replace(re, cfg.replace ?? '')
      const count = (cfg.text.match(re) ?? []).length
      await navigator.clipboard.writeText(result)
      return `${count} replacement${count !== 1 ? 's' : ''} made — result copied`
    },
  },

  {
    id: 'util-json-keys', name: 'List all keys in a JSON object',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'json', label: 'Paste JSON', placeholder: '{"user":{"name":"Alice","age":30}}', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      function collectKeys(obj: unknown, prefix = ''): string[] {
        if (typeof obj !== 'object' || obj === null) return []
        return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
          const path = prefix ? `${prefix}.${k}` : k
          return [path, ...collectKeys(v, path)]
        })
      }
      const keys = collectKeys(JSON.parse(cfg.json))
      await navigator.clipboard.writeText(keys.join('\n'))
      return `${keys.length} keys copied`
    },
  },

  {
    id: 'util-cron-explain', name: 'Explain a cron expression',
    trigger: 'You click Go', triggerType: 'manual', action: 'Show description', canRunNow: true,
    configFields: [
      { key: 'cron', label: 'Cron expression', placeholder: '0 9 * * 1-5', required: true },
    ],
    run: async (cfg) => {
      const [min, hr, dom, mon, dow] = cfg.cron.trim().split(/\s+/)
      const days: Record<string, string> = { '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '1-5': 'Mon–Fri', '0-6': 'every day', '*': 'every day' }
      const months: Record<string, string> = { '*': 'every month', '1': 'Jan', '2': 'Feb', '3': 'Mar', '4': 'Apr', '5': 'May', '6': 'Jun', '7': 'Jul', '8': 'Aug', '9': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec' }
      const time = hr === '*' ? 'every hour' : `${hr.padStart(2, '0')}:${(min ?? '0').padStart(2, '0')}`
      const dayLabel = days[dow] ?? `day-of-week ${dow}`
      const monthLabel = months[mon] ?? `month ${mon}`
      const domLabel = dom === '*' ? '' : ` on the ${dom}${dom === '1' ? 'st' : dom === '2' ? 'nd' : dom === '3' ? 'rd' : 'th'}`
      return `Runs at ${time}, ${dayLabel}, ${monthLabel}${domLabel}`
    },
  },

  {
    id: 'util-case', name: 'Change text case',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Text', placeholder: 'hello world', required: true, type: 'textarea' },
      { key: 'mode', label: 'Mode: upper / lower / title / sentence / camel / snake / kebab', placeholder: 'title', required: true },
    ],
    run: async (cfg) => {
      const t = cfg.text; const m = cfg.mode.trim().toLowerCase()
      let result: string
      if (m === 'upper') result = t.toUpperCase()
      else if (m === 'lower') result = t.toLowerCase()
      else if (m === 'title') result = t.replace(/\b\w/g, c => c.toUpperCase())
      else if (m === 'sentence') result = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
      else if (m === 'camel') result = t.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_: string, c: string) => c.toUpperCase())
      else if (m === 'snake') result = t.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      else if (m === 'kebab') result = t.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      else throw new Error('Unknown mode')
      await navigator.clipboard.writeText(result)
      return `${m} case copied`
    },
  },

  {
    id: 'util-strip-html', name: 'Strip HTML tags — get plain text',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'html', label: 'Paste HTML', placeholder: '<p>Hello <b>world</b></p>', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const div = document.createElement('div')
      // Sanitize before assigning to innerHTML to prevent script execution
      const DOMPurify = (await import('dompurify')).default
      div.innerHTML = DOMPurify.sanitize(cfg.html)
      const text = (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim()
      await navigator.clipboard.writeText(text)
      return `Plain text copied (${text.length} chars)`
    },
  },

  {
    id: 'util-numbers', name: 'Stats on a list of numbers',
    trigger: 'You click Go', triggerType: 'manual', action: 'Show results', canRunNow: true,
    configFields: [
      { key: 'nums', label: 'Numbers (one per line or comma-separated)', placeholder: '12\n45\n7\n98\n23', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const nums = cfg.nums.split(/[\n,]+/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
      if (nums.length === 0) throw new Error('No valid numbers found')
      const sum = nums.reduce((a, b) => a + b, 0)
      const avg = sum / nums.length
      const sorted = [...nums].sort((a, b) => a - b)
      const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)]
      return `Sum ${sum.toLocaleString()} · Avg ${avg.toFixed(2)} · Median ${median} · Min ${sorted[0]} · Max ${sorted[sorted.length - 1]} · Count ${nums.length}`
    },
  },

  {
    id: 'util-tip', name: 'Split a bill + tip',
    trigger: 'You click Go', triggerType: 'manual', action: 'Show results', canRunNow: true,
    configFields: [
      { key: 'bill', label: 'Bill total ($)', placeholder: '87.50', required: true, type: 'number' },
      { key: 'tip', label: 'Tip %', placeholder: '20', type: 'number' },
      { key: 'people', label: 'Number of people', placeholder: '4', type: 'number' },
    ],
    run: async (cfg) => {
      const bill = parseFloat(cfg.bill); const tip = parseFloat(cfg.tip || '18') / 100; const ppl = parseInt(cfg.people || '1', 10)
      const tipAmt = bill * tip; const total = bill + tipAmt; const perPerson = total / ppl
      return `Tip $${tipAmt.toFixed(2)} · Total $${total.toFixed(2)} · Per person $${perPerson.toFixed(2)}`
    },
  },

  {
    id: 'util-age', name: 'Calculate age from birthday',
    trigger: 'You click Go', triggerType: 'manual', action: 'Show result', canRunNow: true,
    configFields: [
      { key: 'dob', label: 'Date of birth', placeholder: '1990-06-15', required: true, type: 'date' },
    ],
    run: async (cfg) => {
      const dob = new Date(cfg.dob); const now = new Date()
      let years = now.getFullYear() - dob.getFullYear()
      const m = now.getMonth() - dob.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years--
      const nextBday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate())
      if (nextBday < now) nextBday.setFullYear(now.getFullYear() + 1)
      const days = Math.ceil((nextBday.getTime() - now.getTime()) / 86400000)
      return `${years} years old · next birthday in ${days} day${days !== 1 ? 's' : ''}`
    },
  },

  {
    id: 'util-business-days', name: 'Business days between two dates',
    trigger: 'You click Go', triggerType: 'manual', action: 'Show result', canRunNow: true,
    configFields: [
      { key: 'start', label: 'Start date', placeholder: '2024-01-01', required: true, type: 'date' },
      { key: 'end', label: 'End date', placeholder: '2024-01-31', required: true, type: 'date' },
    ],
    run: async (cfg) => {
      const d = new Date(cfg.start); const end = new Date(cfg.end); let count = 0
      while (d <= end) { const day = d.getDay(); if (day !== 0 && day !== 6) count++; d.setDate(d.getDate() + 1) }
      const calendar = Math.round((end.getTime() - new Date(cfg.start).getTime()) / 86400000) + 1
      return `${count} business days · ${calendar} calendar days`
    },
  },

  {
    id: 'util-unit', name: 'Unit converter',
    trigger: 'You click Go', triggerType: 'manual', action: 'Show result', canRunNow: true,
    configFields: [
      { key: 'value', label: 'Value', placeholder: '100', required: true, type: 'number' },
      { key: 'from', label: 'From unit', placeholder: 'km, mi, kg, lb, C, F, cm, in, L, gal, m, ft', required: true },
      { key: 'to', label: 'To unit', placeholder: 'mi, km, lb, kg, F, C, in, cm, gal, L, ft, m', required: true },
    ],
    run: async (cfg) => {
      const v = parseFloat(cfg.value); const f = cfg.from.trim().toLowerCase(); const t = cfg.to.trim().toLowerCase()
      const map: Record<string, Record<string, (n: number) => number>> = {
        km: { mi: n => n * 0.621371, m: n => n * 1000, ft: n => n * 3280.84 },
        mi: { km: n => n * 1.60934, m: n => n * 1609.34, ft: n => n * 5280 },
        kg: { lb: n => n * 2.20462, g: n => n * 1000, oz: n => n * 35.274 },
        lb: { kg: n => n * 0.453592, oz: n => n * 16, g: n => n * 453.592 },
        c: { f: n => n * 9 / 5 + 32, k: n => n + 273.15 },
        f: { c: n => (n - 32) * 5 / 9, k: n => (n - 32) * 5 / 9 + 273.15 },
        cm: { in: n => n * 0.393701, m: n => n / 100, ft: n => n * 0.0328084 },
        in: { cm: n => n * 2.54, m: n => n * 0.0254, ft: n => n / 12 },
        m: { ft: n => n * 3.28084, cm: n => n * 100, km: n => n / 1000, in: n => n * 39.3701 },
        ft: { m: n => n * 0.3048, cm: n => n * 30.48, in: n => n * 12, mi: n => n / 5280 },
        l: { gal: n => n * 0.264172, ml: n => n * 1000, oz: n => n * 33.814 },
        gal: { l: n => n * 3.78541, ml: n => n * 3785.41, oz: n => n * 128 },
      }
      const fn = map[f]?.[t]
      if (!fn) throw new Error(`Don't know how to convert ${f} → ${t}`)
      const result = fn(v)
      return `${v} ${cfg.from} = ${result.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${cfg.to}`
    },
  },

  {
    id: 'util-phone-extract', name: 'Extract phone numbers from text',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Paste any text', placeholder: 'Call us at (555) 867-5309 or 1-800-555-1234', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const phones = [...new Set(cfg.text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g) ?? [])]
      if (phones.length === 0) throw new Error('No phone numbers found')
      await navigator.clipboard.writeText(phones.join('\n'))
      return `${phones.length} phone number${phones.length !== 1 ? 's' : ''} copied`
    },
  },

  {
    id: 'util-markdown-toc', name: 'Generate table of contents from Markdown',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'md', label: 'Paste Markdown', placeholder: '# Title\n## Section 1\n### Subsection', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const lines = cfg.md.split('\n').filter(l => /^#{1,6}\s/.test(l))
      const toc = lines.map(l => {
        const level = l.match(/^(#+)/)?.[1].length ?? 1
        const text = l.replace(/^#+\s+/, '').trim()
        const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
        return `${'  '.repeat(level - 1)}- [${text}](#${anchor})`
      }).join('\n')
      await navigator.clipboard.writeText(toc)
      return `TOC with ${lines.length} entries copied`
    },
  },

  {
    id: 'util-char-count', name: 'Character counter (Twitter / SMS limits)',
    trigger: 'You click Go', triggerType: 'manual', action: 'Show stats', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Your text', placeholder: 'Type or paste your post…', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const len = cfg.text.length
      const tw = 280 - len; const sms = 160 - len; const smsLong = 1600 - len
      const twStatus = tw >= 0 ? `✓ ${tw} left` : `✗ ${Math.abs(tw)} over`
      const smsStatus = sms >= 0 ? `✓ fits in 1 SMS` : smsLong >= 0 ? `⚠ ${Math.ceil(len / 160)} SMS parts` : '✗ too long for SMS'
      return `${len} chars · Twitter: ${twStatus} · SMS: ${smsStatus}`
    },
  },

  {
    id: 'util-shuffle', name: 'Shuffle lines randomly',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Lines to shuffle', placeholder: 'Alice\nBob\nCarol\nDave', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const lines = cfg.text.split('\n').filter(Boolean)
      for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]]
      }
      await navigator.clipboard.writeText(lines.join('\n'))
      return `${lines.length} lines shuffled and copied`
    },
  },

  {
    id: 'util-lorem', name: 'Generate Lorem Ipsum',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'paragraphs', label: 'Paragraphs', placeholder: '3', type: 'number' },
    ],
    run: async (cfg) => {
      const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure dolor reprehenderit voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ')
      const n = Math.min(parseInt(cfg.paragraphs || '3', 10), 10)
      const paras = Array.from({ length: n }, (_, pi) => {
        const sentences = Math.floor(Math.random() * 3) + 3
        return Array.from({ length: sentences }, () => {
          const len = Math.floor(Math.random() * 10) + 8
          const w = Array.from({ length: len }, (__, i) => words[(pi * len + i) % words.length])
          return w[0].charAt(0).toUpperCase() + w[0].slice(1) + ' ' + w.slice(1).join(' ') + '.'
        }).join(' ')
      }).join('\n\n')
      await navigator.clipboard.writeText(paras)
      return `${n} paragraph${n !== 1 ? 's' : ''} copied`
    },
  },

  {
    id: 'util-add-line-numbers', name: 'Add line numbers to text',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Text', placeholder: 'First line\nSecond line', required: true, type: 'textarea' },
      { key: 'start', label: 'Start at', placeholder: '1', type: 'number' },
    ],
    run: async (cfg) => {
      const start = parseInt(cfg.start || '1', 10)
      const lines = cfg.text.split('\n')
      const width = String(start + lines.length - 1).length
      const numbered = lines.map((l, i) => `${String(start + i).padStart(width, ' ')}  ${l}`).join('\n')
      await navigator.clipboard.writeText(numbered)
      return `${lines.length} lines numbered and copied`
    },
  },

  {
    id: 'util-chunk-text', name: 'Split text into chunks',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Text to split', placeholder: 'Your long content…', required: true, type: 'textarea' },
      { key: 'size', label: 'Chunk size (chars)', placeholder: '500', required: true, type: 'number' },
    ],
    run: async (cfg) => {
      const size = parseInt(cfg.size, 10)
      const chunks: string[] = []
      for (let i = 0; i < cfg.text.length; i += size) chunks.push(cfg.text.slice(i, i + size))
      const labeled = chunks.map((c, i) => `--- Chunk ${i + 1}/${chunks.length} ---\n${c}`).join('\n\n')
      await navigator.clipboard.writeText(labeled)
      return `Split into ${chunks.length} chunks of ≤${size} chars`
    },
  },

  {
    id: 'util-redact', name: 'Redact sensitive data from text',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Text to redact', placeholder: 'Paste a document, email thread…', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      let t = cfg.text
      let count = 0
      const redact = (re: RegExp, label: string) => {
        const matches = t.match(re) ?? []
        count += matches.length
        t = t.replace(re, `[REDACTED-${label}]`)
      }
      redact(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, 'CC')
      redact(/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, 'SSN')
      redact(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'EMAIL')
      redact(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g, 'PHONE')
      await navigator.clipboard.writeText(t)
      return `${count} item${count !== 1 ? 's' : ''} redacted — clean text copied`
    },
  },

  {
    id: 'util-percentage', name: 'Percentage calculator',
    trigger: 'You click Go', triggerType: 'manual', action: 'Show result', canRunNow: true,
    configFields: [
      { key: 'mode', label: 'What do you need?  pct-of / is-what-pct / pct-change', placeholder: 'pct-of', required: true },
      { key: 'a', label: 'First number', placeholder: '20', required: true, type: 'number' },
      { key: 'b', label: 'Second number', placeholder: '200', required: true, type: 'number' },
    ],
    run: async (cfg) => {
      const a = parseFloat(cfg.a); const b = parseFloat(cfg.b); const m = cfg.mode.trim().toLowerCase()
      if (m === 'pct-of') return `${a}% of ${b} = ${(a / 100 * b).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
      if (m === 'is-what-pct') return `${a} is ${((a / b) * 100).toFixed(2)}% of ${b}`
      if (m === 'pct-change') { const ch = ((b - a) / a) * 100; return `${a} → ${b} is a ${ch >= 0 ? '+' : ''}${ch.toFixed(2)}% change` }
      throw new Error('Mode must be pct-of, is-what-pct, or pct-change')
    },
  },

  {
    id: 'util-clean-text', name: 'Clean up messy text',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Messy text', placeholder: 'Paste text with weird spaces, smart quotes, etc.', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      let t = cfg.text
      t = t.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"') // smart quotes
      t = t.replace(/\u2013/g, '-').replace(/\u2014/g, '--') // em/en dashes
      t = t.replace(/\u00A0/g, ' ').replace(/\u200B/g, '') // nbsp, zero-width space
      t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n') // normalize line endings
      t = t.replace(/[ \t]+$/gm, '') // trailing spaces
      t = t.replace(/\n{3,}/g, '\n\n') // excess blank lines
      t = t.trim()
      await navigator.clipboard.writeText(t)
      return `Cleaned text copied (${t.length} chars)`
    },
  },

  {
    id: 'util-timezone', name: 'Convert time between timezones',
    trigger: 'You click Go', triggerType: 'manual', action: 'Show result', canRunNow: true,
    configFields: [
      { key: 'time', label: 'Time (leave blank for now)', placeholder: '2024-03-01T14:00' },
      { key: 'from', label: 'From timezone', placeholder: 'America/New_York', required: true },
      { key: 'to', label: 'To timezone', placeholder: 'Europe/London', required: true },
    ],
    run: async (cfg) => {
      const d = cfg.time ? new Date(cfg.time) : new Date()
      const fmt = (tz: string) => d.toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
      return `${fmt(cfg.from)}  →  ${fmt(cfg.to)}`
    },
  },

  {
    id: 'util-roman', name: 'Convert Roman numerals ↔ numbers',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'value', label: 'Number or Roman numeral', placeholder: '42  or  XLII', required: true },
    ],
    run: async (cfg) => {
      const v = cfg.value.trim()
      let result: string
      if (/^\d+$/.test(v)) {
        let n = parseInt(v); let r = ''
        const vals: [number, string][] = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]
        for (const [num, sym] of vals) { while (n >= num) { r += sym; n -= num } }
        result = r || 'nulla'
      } else {
        const map: Record<string, number> = {I:1,V:5,X:10,L:50,C:100,D:500,M:1000}
        const s = v.toUpperCase(); let n = 0
        for (let i = 0; i < s.length; i++) { const cur = map[s[i]] ?? 0; const next = map[s[i+1]] ?? 0; n += cur < next ? -cur : cur }
        result = String(n)
      }
      await navigator.clipboard.writeText(result)
      return `${v} = ${result}`
    },
  },

  {
    id: 'util-list-to-numbered', name: 'Toggle bullet list ↔ numbered list',
    trigger: 'You click Go', triggerType: 'manual', action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'List items', placeholder: '- Apples\n- Bananas\nor\n1. Apples\n2. Bananas', required: true, type: 'textarea' },
    ],
    run: async (cfg) => {
      const lines = cfg.text.split('\n').filter(Boolean)
      const isBullet = lines.some(l => /^[-*•]\s/.test(l))
      let result: string
      if (isBullet) {
        let i = 0
        result = lines.map(l => { const t = l.replace(/^[-*•]\s+/, ''); return /^[-*•]\s/.test(l) ? `${++i}. ${t}` : l }).join('\n')
      } else {
        result = lines.map(l => l.replace(/^\d+[.)]\s+/, '- ')).join('\n')
      }
      await navigator.clipboard.writeText(result)
      return `Converted to ${isBullet ? 'numbered' : 'bullet'} list and copied`
    },
  },

  { id:'util-summarize', name:'Summarize long text', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'text',label:'Text to summarize',placeholder:'Paste a long document, email, or article…',required:true,type:'textarea' as const},{key:'sentences',label:'Max sentences in summary',placeholder:'5',type:'number' as const}],
    run:async(cfg)=>{const max=parseInt(cfg.sentences||'5',10);const sents=cfg.text.match(/[^.!?]+[.!?]+/g)||[];const top=sents.slice(0,max).map((s:string)=>s.trim()).join(' ');await navigator.clipboard.writeText(top);return`Summary (${max} sentences) copied`}},

  { id:'util-bullets-to-prose', name:'Convert bullet points → prose paragraph', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'text',label:'Bullet points',placeholder:'- First point\n- Second point',required:true,type:'textarea' as const}],
    run:async(cfg)=>{const items=cfg.text.split('\n').map((l:string)=>l.replace(/^[-*•\d.]+\s*/,'').trim()).filter(Boolean);const prose=items.join('. ')+'.';await navigator.clipboard.writeText(prose);return`Converted ${items.length} bullets to prose`}},

  { id:'util-reverse', name:'Reverse text or lines', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'text',label:'Text',placeholder:'Hello world',required:true,type:'textarea' as const},{key:'mode',label:'Mode: chars or lines',placeholder:'lines'}],
    run:async(cfg)=>{const m=(cfg.mode||'lines').trim();let result:string;if(m==='chars')result=cfg.text.split('').reverse().join('');else result=cfg.text.split('\n').reverse().join('\n');await navigator.clipboard.writeText(result);return`Reversed (${m}) and copied`}},

  { id:'util-reading-time', name:'Estimate reading time', trigger:'You click Go', triggerType:'manual', action:'Show result', canRunNow:true,
    configFields:[{key:'text',label:'Text',placeholder:'Paste your document…',required:true,type:'textarea' as const}],
    run:async(cfg)=>{const words=cfg.text.trim().split(/\s+/).filter(Boolean).length;const mins=Math.ceil(words/238);return`${words.toLocaleString()} words · ~${mins} min read at average pace`}},

  { id:'util-strip-whitespace', name:'Strip extra whitespace and blank lines', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'text',label:'Text',placeholder:'Messy text…',required:true,type:'textarea' as const}],
    run:async(cfg)=>{const result=cfg.text.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').replace(/[ \t]+$/gm,'').trim();await navigator.clipboard.writeText(result);return`Cleaned — ${result.length} chars`}},

  { id:'util-slug', name:'Convert text to URL slug', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'text',label:'Text',placeholder:'Hello World! This is a title.',required:true}],
    run:async(cfg)=>{const slug=cfg.text.toLowerCase().replace(/[^\w\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');await navigator.clipboard.writeText(slug);return`Slug: ${slug}`}},

  { id:'util-unique-values', name:'Extract unique values from a list', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'text',label:'List (one per line or comma-separated)',placeholder:'apple\nbanana\napple\ncherry',required:true,type:'textarea' as const}],
    run:async(cfg)=>{const items=cfg.text.split(/[\n,]+/).map((s:string)=>s.trim()).filter(Boolean);const unique=[...new Set(items)];await navigator.clipboard.writeText(unique.join('\n'));return`${unique.length} unique values (removed ${items.length-unique.length} duplicates)`}},

  { id:'util-md-table-to-csv', name:'Convert Markdown table → CSV', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'table',label:'Markdown table',placeholder:'| Name | Age |\n|------|-----|\n| Alice | 30 |',required:true,type:'textarea' as const}],
    run:async(cfg)=>{const rows=cfg.table.trim().split('\n').filter((l:string)=>!/^[|\s-]+$/.test(l));const csv=rows.map((r:string)=>r.split('|').map((c:string)=>c.trim()).filter(Boolean).map((c:string)=>`"${c.replace(/"/g,'""')}"`).join(',')).join('\n');await navigator.clipboard.writeText(csv);return`${rows.length} rows converted`}},

  { id:'util-csv-to-md-table', name:'Convert CSV → Markdown table', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'csv',label:'CSV',placeholder:'Name,Age\nAlice,30',required:true,type:'textarea' as const}],
    run:async(cfg)=>{const lines=cfg.csv.trim().split('\n');const rows=lines.map((l:string)=>l.split(',').map((c:string)=>c.trim().replace(/^"|"$/g,'')));const widths=rows[0].map((_:string,i:number)=>Math.max(...rows.map((r:string[])=>(r[i]||'').length)));const fmt=(r:string[])=>'| '+r.map((c:string,i:number)=>c.padEnd(widths[i])).join(' | ')+' |';const sep='| '+widths.map((w:number)=>'-'.repeat(w)).join(' | ')+' |';const md=[fmt(rows[0]),sep,...rows.slice(1).map(fmt)].join('\n');await navigator.clipboard.writeText(md);return`Table with ${rows.length-1} rows copied`}},

  { id:'util-merge-lists', name:'Merge two lists — remove duplicates', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'list1',label:'List 1 (one per line)',placeholder:'apple\nbanana',required:true,type:'textarea' as const},{key:'list2',label:'List 2 (one per line)',placeholder:'banana\ncherry',required:true,type:'textarea' as const}],
    run:async(cfg)=>{const a=cfg.list1.split('\n').map((s:string)=>s.trim()).filter(Boolean);const b=cfg.list2.split('\n').map((s:string)=>s.trim()).filter(Boolean);const merged=[...new Set([...a,...b])];await navigator.clipboard.writeText(merged.join('\n'));return`Merged: ${merged.length} unique items (${a.length}+${b.length} input)`}},

  { id:'util-nato', name:'Convert text to NATO phonetic alphabet', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'text',label:'Text to spell out',placeholder:'Hello',required:true}],
    run:async(cfg)=>{const NATO:Record<string,string>={A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-Ray',Y:'Yankee',Z:'Zulu',' ':'(space)','0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine'};const result=cfg.text.toUpperCase().split('').map((c:string)=>NATO[c]||c).join(' · ');await navigator.clipboard.writeText(result);return result}},

  { id:'util-flatten-json', name:'Flatten nested JSON', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'json',label:'Nested JSON',placeholder:'{"user":{"name":"Alice","address":{"city":"Boston"}}}',required:true,type:'textarea' as const}],
    run:async(cfg)=>{function flat(obj:unknown,prefix=''):Record<string,unknown>{if(typeof obj!=='object'||obj===null)return{[prefix]:obj};return Object.entries(obj as Record<string,unknown>).reduce((acc,[k,v])=>({...acc,...flat(v,prefix?`${prefix}.${k}`:k)}),{} as Record<string,unknown>)}const result=flat(JSON.parse(cfg.json));const json=JSON.stringify(result,null,2);await navigator.clipboard.writeText(json);return`Flattened to ${Object.keys(result).length} keys`}},

  { id:'util-text-diff', name:'Diff two blocks of text', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'a',label:'Original text',placeholder:'Hello world\nLine two',required:true,type:'textarea' as const},{key:'b',label:'New text',placeholder:'Hello there\nLine two\nLine three',required:true,type:'textarea' as const}],
    run:async(cfg)=>{const aLines=cfg.a.split('\n');const bLines=cfg.b.split('\n');const bSet=new Set(bLines);const aSet=new Set(aLines);const removed=aLines.filter((l:string)=>!bSet.has(l)).map((l:string)=>`- ${l}`);const added=bLines.filter((l:string)=>!aSet.has(l)).map((l:string)=>`+ ${l}`);const diff=[...removed,...added].join('\n')||'No differences found';await navigator.clipboard.writeText(diff);return`${removed.length} removed, ${added.length} added`}},

  { id:'calc-add-biz-days', name:'Add business days to a date', trigger:'You click Go', triggerType:'manual', action:'Show result', canRunNow:true,
    configFields:[{key:'date',label:'Start date',placeholder:'2024-03-01',required:true,type:'date' as const},{key:'days',label:'Business days to add',placeholder:'10',required:true,type:'number' as const}],
    run:async(cfg)=>{const d=new Date(cfg.date);let n=parseInt(cfg.days,10);while(n>0){d.setDate(d.getDate()+1);if(d.getDay()!==0&&d.getDay()!==6)n--}return`${parseInt(cfg.days)} business days from ${new Date(cfg.date).toLocaleDateString()} = ${d.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`}},

  { id:'calc-compound-interest', name:'Calculate compound interest', trigger:'You click Go', triggerType:'manual', action:'Show result', canRunNow:true,
    configFields:[{key:'principal',label:'Principal ($)',placeholder:'10000',required:true,type:'number' as const},{key:'rate',label:'Annual interest rate (%)',placeholder:'7',required:true,type:'number' as const},{key:'years',label:'Years',placeholder:'10',required:true,type:'number' as const},{key:'compounds',label:'Times compounded per year',placeholder:'12',type:'number' as const}],
    run:async(cfg)=>{const p=parseFloat(cfg.principal),r=parseFloat(cfg.rate)/100,t=parseFloat(cfg.years),n=parseFloat(cfg.compounds||'12');const A=p*Math.pow(1+r/n,n*t);const interest=A-p;return`$${p.toLocaleString()} grows to $${A.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')} · Interest earned: $${interest.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')}`}},

  { id:'calc-currency', name:'Convert currency (live rate)', trigger:'You click Go', triggerType:'manual', action:'Show result', canRunNow:true,
    configFields:[{key:'amount',label:'Amount',placeholder:'100',required:true,type:'number' as const},{key:'from',label:'From currency',placeholder:'USD',required:true},{key:'to',label:'To currency',placeholder:'EUR',required:true}],
    run:async(cfg)=>{const res=await fetch(`https://open.er-api.com/v6/latest/${cfg.from.toUpperCase()}`);if(!res.ok)throw new Error('Could not fetch rates');const data=await res.json();const rate=data.rates?.[cfg.to.toUpperCase()];if(!rate)throw new Error(`Unknown currency: ${cfg.to}`);const result=parseFloat(cfg.amount)*rate;return`${cfg.amount} ${cfg.from.toUpperCase()} = ${result.toLocaleString(undefined,{maximumFractionDigits:2})} ${cfg.to.toUpperCase()} (rate: ${rate})`}},

  { id:'calc-loan', name:'Loan / mortgage payment calculator', trigger:'You click Go', triggerType:'manual', action:'Show result', canRunNow:true,
    configFields:[{key:'principal',label:'Loan amount ($)',placeholder:'250000',required:true,type:'number' as const},{key:'rate',label:'Annual interest rate (%)',placeholder:'6.5',required:true,type:'number' as const},{key:'years',label:'Loan term (years)',placeholder:'30',required:true,type:'number' as const}],
    run:async(cfg)=>{const P=parseFloat(cfg.principal),r=parseFloat(cfg.rate)/100/12,n=parseFloat(cfg.years)*12;const M=P*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);const total=M*n;return`Monthly payment: $${M.toFixed(2)} · Total paid: $${total.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')} · Interest: $${(total-P).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}`}},

  { id:'calc-project-cost', name:'Calculate project cost from hourly rate', trigger:'You click Go', triggerType:'manual', action:'Show result', canRunNow:true,
    configFields:[{key:'rate',label:'Hourly rate ($)',placeholder:'150',required:true,type:'number' as const},{key:'hours',label:'Estimated hours',placeholder:'40',required:true,type:'number' as const},{key:'margin',label:'Markup/overhead (%)',placeholder:'20',type:'number' as const}],
    run:async(cfg)=>{const base=parseFloat(cfg.rate)*parseFloat(cfg.hours);const margin=parseFloat(cfg.margin||'0')/100;const total=base*(1+margin);return`Base: $${base.toLocaleString()} · With ${cfg.margin||'0'}% overhead: $${total.toLocaleString(undefined,{maximumFractionDigits:2})}`}},

  { id:'calc-temp', name:'Convert temperature (F ↔ C ↔ K)', trigger:'You click Go', triggerType:'manual', action:'Show result', canRunNow:true,
    configFields:[{key:'value',label:'Temperature',placeholder:'98.6',required:true,type:'number' as const},{key:'from',label:'From (F/C/K)',placeholder:'F',required:true}],
    run:async(cfg)=>{const v=parseFloat(cfg.value);const f=cfg.from.toUpperCase().trim();let C:number;if(f==='F')C=(v-32)*5/9;else if(f==='K')C=v-273.15;else C=v;const F=C*9/5+32;const K=C+273.15;return`${v}°${f} = ${C.toFixed(2)}°C = ${F.toFixed(2)}°F = ${K.toFixed(2)}K`}},

  { id:'calc-weighted-avg', name:'Calculate weighted average', trigger:'You click Go', triggerType:'manual', action:'Show result', canRunNow:true,
    configFields:[{key:'values',label:'Values (one per line)',placeholder:'85\n92\n78',required:true,type:'textarea' as const},{key:'weights',label:'Weights (one per line, same order)',placeholder:'0.4\n0.4\n0.2',required:true,type:'textarea' as const}],
    run:async(cfg)=>{const vals=cfg.values.split('\n').map((s:string)=>parseFloat(s.trim())).filter((n:number)=>!isNaN(n));const wts=cfg.weights.split('\n').map((s:string)=>parseFloat(s.trim())).filter((n:number)=>!isNaN(n));if(vals.length!==wts.length)throw new Error('Number of values and weights must match');const sum=vals.reduce((acc:number,v:number,i:number)=>acc+v*wts[i],0);const wsum=wts.reduce((a:number,b:number)=>a+b,0);return`Weighted average: ${(sum/wsum).toFixed(4)} (weight sum: ${wsum.toFixed(2)})`}},

  { id:'calc-dim-weight', name:'Calculate dimensional / shipping weight', trigger:'You click Go', triggerType:'manual', action:'Show result', canRunNow:true,
    configFields:[{key:'l',label:'Length (in)',placeholder:'12',required:true,type:'number' as const},{key:'w',label:'Width (in)',placeholder:'8',required:true,type:'number' as const},{key:'h',label:'Height (in)',placeholder:'6',required:true,type:'number' as const},{key:'actual',label:'Actual weight (lbs)',placeholder:'3.5',type:'number' as const}],
    run:async(cfg)=>{const dim=(parseFloat(cfg.l)*parseFloat(cfg.w)*parseFloat(cfg.h))/139;const actual=parseFloat(cfg.actual||'0');const billable=Math.max(dim,actual);return`Dim weight: ${dim.toFixed(2)} lbs · Actual: ${actual} lbs · Billable: ${billable.toFixed(2)} lbs`}},

  { id:'util-expand-url', name:'Expand a shortened URL', trigger:'You click Go', triggerType:'manual', action:'Show full URL', canRunNow:true,
    configFields:[{key:'url',label:'Shortened URL',placeholder:'https://bit.ly/abc123',required:true}],
    run:async(cfg)=>{const res=await fetch(`https://unshorten.me/json/${encodeURIComponent(cfg.url)}`);if(!res.ok)throw new Error('Could not expand URL');const data=await res.json();const full=data.resolved_url||data.requestedURL;await navigator.clipboard.writeText(full);return`Full URL: ${full}`}},

  { id:'util-geocode', name:'Geocode an address → lat/lng', trigger:'You click Go', triggerType:'manual', action:'Show result', canRunNow:true,
    configFields:[{key:'address',label:'Address',placeholder:'1 Main St, Boston, MA 02108',required:true}],
    run:async(cfg)=>{const res=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cfg.address)}&format=json&limit=1`,{headers:{'User-Agent':'Workspace/1.0'}});const data=await res.json();if(!data?.[0])throw new Error('Address not found');const{lat,lon,display_name}=data[0];await navigator.clipboard.writeText(`${lat},${lon}`);return`${display_name}\n📍 ${lat}, ${lon} (copied)`}},

  { id:'util-ics', name:'Generate an iCal (.ics) event file', trigger:'You click Go', triggerType:'manual', action:'Download .ics', canRunNow:true,
    configFields:[{key:'title',label:'Event title',placeholder:'Team Standup',required:true},{key:'start',label:'Start date/time',placeholder:'2024-03-15T10:00',required:true,type:'date' as const},{key:'end',label:'End date/time',placeholder:'2024-03-15T10:30',required:true,type:'date' as const},{key:'location',label:'Location or URL',placeholder:'Zoom: https://zoom.us/j/…'}],
    run:async(cfg)=>{const fmt=(d:string)=>new Date(d).toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';const uid=crypto.randomUUID();const ics=`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Workspace//EN\nBEGIN:VEVENT\nUID:${uid}\nDTSTAMP:${fmt(new Date().toISOString())}\nDTSTART:${fmt(cfg.start)}\nDTEND:${fmt(cfg.end)}\nSUMMARY:${cfg.title}\n${cfg.location?`LOCATION:${cfg.location}\n`:''}END:VEVENT\nEND:VCALENDAR`;const blob=new Blob([ics],{type:'text/calendar'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${cfg.title.replace(/\s+/g,'-')}.ics`;a.click();return`${cfg.title}.ics downloaded`}},

  { id:'util-numbered-to-checklist', name:'Convert numbered list → Markdown checklist', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'text',label:'Numbered list',placeholder:'1. Send invoice\n2. Follow up with client',required:true,type:'textarea' as const}],
    run:async(cfg)=>{const result=cfg.text.split('\n').map((l:string)=>l.replace(/^\d+[.)]\s+/,'- [ ] ')).join('\n');await navigator.clipboard.writeText(result);return'Checklist copied'}},

  { id:'util-readme', name:'Generate a project README from a template', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'name',label:'Project name',placeholder:'my-awesome-project',required:true},{key:'description',label:'What it does',placeholder:'A tool that automatically…',required:true,type:'textarea' as const},{key:'stack',label:'Tech stack',placeholder:'Node.js, TypeScript, PostgreSQL'}],
    run:async(cfg)=>{const fence='```';const readme=`# ${cfg.name}\n\n${cfg.description}\n\n## Tech Stack\n\n${(cfg.stack||'').split(',').map((s:string)=>`- ${s.trim()}`).join('\n')}\n\n## Getting Started\n\n${fence}bash\ngit clone https://github.com/your-org/${cfg.name.toLowerCase().replace(/\s+/g,'-')}\ncd ${cfg.name.toLowerCase().replace(/\s+/g,'-')}\nnpm install\nnpm run dev\n${fence}\n\n## Contributing\n\nPull requests welcome.\n\n## License\n\nMIT`;await navigator.clipboard.writeText(readme);return`README for ${cfg.name} copied`}},

  { id:'util-validate-email', name:'Validate an email address format', trigger:'You click Go', triggerType:'manual', action:'Show result', canRunNow:true,
    configFields:[{key:'email',label:'Email address',placeholder:'user@example.com',required:true,type:'email' as const}],
    run:async(cfg)=>{const re=/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;const valid=re.test(cfg.email.trim());const domain=cfg.email.split('@')[1]||'';return(valid?'OK':'INVALID')+' | '+cfg.email+(valid?' | domain: '+domain:'')}},

  { id:'util-qr-code', name:'Generate a QR code for any URL or text', trigger:'You click Go', triggerType:'manual', action:'Open QR image', canRunNow:true,
    configFields:[{key:'text',label:'Text or URL to encode',placeholder:'https://publiclogic.org',required:true},{key:'size',label:'Size (px)',placeholder:'300',type:'number' as const}],
    run:async(cfg)=>{const size=parseInt(cfg.size||'300',10);const url=`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(cfg.text)}`;window.open(url,'_blank');await navigator.clipboard.writeText(url);return`QR code opened in new tab · image URL copied`}},

  {
    id: 'util-jwt-decode', name: 'Decode a JWT (inspect without verifying)',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'token', label: 'JWT token', placeholder: 'eyJhbGciOi…', required: true, type: 'textarea' as const },
    ],
    run: async (cfg) => {
      const parts = cfg.token.trim().split('.')
      if (parts.length < 2) throw new Error('Not a valid JWT (must have 2+ parts)')
      const decode = (s: string) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')))
      const header = decode(parts[0])
      const payload = decode(parts[1])
      const out = JSON.stringify({ header, payload }, null, 2)
      await navigator.clipboard.writeText(out)
      const exp = payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'no exp'
      return `Decoded · exp: ${exp} · copied`
    },
  },

  {
    id: 'util-slug', name: 'Convert text to URL slug',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Text to slugify', placeholder: 'My Awesome Blog Post!', required: true },
    ],
    run: async (cfg) => {
      const slug = cfg.text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      await navigator.clipboard.writeText(slug)
      return `Slug copied: ${slug}`
    },
  },

  {
    id: 'util-lorem', name: 'Generate Lorem Ipsum text',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'paragraphs', label: 'Paragraphs', placeholder: '3', type: 'number' as const },
    ],
    run: async (cfg) => {
      const n = Math.max(1, Math.min(parseInt(cfg.paragraphs || '3', 10), 10))
      const sentences = ['Lorem ipsum dolor sit amet, consectetur adipiscing elit.','Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.','Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.','Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.','Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.','Nulla pariatur — clamat ad astra, de profundis et sic semper tyrannis.','Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere.']
      const para = () => Array.from({ length: 4 + Math.floor(Math.random() * 3) }, (_, i) => sentences[i % sentences.length]).join(' ')
      const text = Array.from({ length: n }, para).join('\n\n')
      await navigator.clipboard.writeText(text)
      return `${n} paragraph${n !== 1 ? 's' : ''} copied`
    },
  },

  {
    id: 'util-json-minify', name: 'Minify JSON',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'json', label: 'Paste JSON', placeholder: '{\n  "key": "value"\n}', required: true, type: 'textarea' as const },
    ],
    run: async (cfg) => {
      const minified = JSON.stringify(JSON.parse(cfg.json))
      await navigator.clipboard.writeText(minified)
      return `Minified — ${minified.length} chars (was ${cfg.json.length})`
    },
  },

  {
    id: 'util-env-to-json', name: 'Convert .env file → JSON object',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'env', label: 'Paste .env content', placeholder: 'KEY=value\nANOTHER=stuff', required: true, type: 'textarea' as const },
    ],
    run: async (cfg) => {
      const obj = Object.fromEntries(cfg.env.split('\n').filter((l: string) => l && !l.startsWith('#')).map((l: string) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }))
      const json = JSON.stringify(obj, null, 2)
      await navigator.clipboard.writeText(json)
      return `${Object.keys(obj).length} keys copied as JSON`
    },
  },

  {
    id: 'util-json-to-env', name: 'Convert JSON object → .env format',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'json', label: 'Paste JSON object', placeholder: '{"KEY":"value"}', required: true, type: 'textarea' as const },
    ],
    run: async (cfg) => {
      const obj = JSON.parse(cfg.json) as Record<string, unknown>
      const env = Object.entries(obj).map(([k, v]) => `${k.toUpperCase()}=${v}`).join('\n')
      await navigator.clipboard.writeText(env)
      return `${Object.keys(obj).length} vars copied as .env`
    },
  },

  {
    id: 'util-text-stats', name: 'Detailed text statistics',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Show result', canRunNow: true,
    configFields: [
      { key: 'text', label: 'Text', placeholder: 'Paste any text…', required: true, type: 'textarea' as const },
    ],
    run: async (cfg) => {
      const t = cfg.text
      const words = t.trim().split(/\s+/).filter(Boolean).length
      const sentences = (t.match(/[.!?]+/g) ?? []).length
      const chars = t.length
      const noSpaces = t.replace(/\s/g, '').length
      const lines = t.split('\n').length
      const avgWordLen = noSpaces / Math.max(words, 1)
      return `${words.toLocaleString()} words · ${chars.toLocaleString()} chars · ${lines} lines · ${sentences} sentences · avg word ${avgWordLen.toFixed(1)} chars`
    },
  },

  {
    id: 'util-number-format', name: 'Format a large number with commas',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Copy to clipboard', canRunNow: true,
    configFields: [
      { key: 'num', label: 'Number', placeholder: '1234567.89', required: true },
      { key: 'locale', label: 'Locale (optional)', placeholder: 'en-US' },
    ],
    run: async (cfg) => {
      const n = parseFloat(cfg.num.replace(/,/g, ''))
      const locale = cfg.locale || 'en-US'
      const formatted = n.toLocaleString(locale)
      await navigator.clipboard.writeText(formatted)
      return `Formatted: ${formatted}`
    },
  },

  {
    id: 'util-epoch-now', name: 'Get current Unix timestamp',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Copy to clipboard', canRunNow: true,
    configFields: [],
    run: async () => {
      const ts = Math.floor(Date.now() / 1000).toString()
      await navigator.clipboard.writeText(ts)
      return `Unix timestamp: ${ts} · ${new Date().toISOString()}`
    },
  },

  {
    id: 'util-diff-lines', name: 'Find lines added/removed between two texts',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Copy diff to clipboard', canRunNow: true,
    configFields: [
      { key: 'before', label: 'Original text', placeholder: 'Paste original…', required: true, type: 'textarea' as const },
      { key: 'after', label: 'New text', placeholder: 'Paste new version…', required: true, type: 'textarea' as const },
    ],
    run: async (cfg) => {
      const a = new Set(cfg.before.split('\n').map((l: string) => l.trim()).filter(Boolean))
      const b = new Set(cfg.after.split('\n').map((l: string) => l.trim()).filter(Boolean))
      const added = [...b].filter(l => !a.has(l)).map(l => `+ ${l}`)
      const removed = [...a].filter(l => !b.has(l)).map(l => `- ${l}`)
      const diff = [...removed, ...added].join('\n')
      await navigator.clipboard.writeText(diff || '(no differences)')
      return `${added.length} added · ${removed.length} removed · diff copied`
    },
  },

  {
    id: 'util-markdown-to-html', name: 'Convert Markdown → HTML',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Copy HTML to clipboard', canRunNow: true,
    configFields: [
      { key: 'md', label: 'Markdown', placeholder: '# Heading\n\n- item\n\n**bold**', required: true, type: 'textarea' as const },
    ],
    run: async (cfg) => {
      const html = cfg.md
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^([^<].+)$/gm, (m: string) => m.startsWith('<') ? m : `<p>${m}</p>`)
      await navigator.clipboard.writeText(html)
      return `HTML copied (${html.split('\n').length} lines)`
    },
  },

  {
    id: 'util-password-strength', name: 'Check password strength',
    trigger: 'You click Go', triggerType: 'manual' as const, action: 'Show result', canRunNow: true,
    configFields: [
      { key: 'password', label: 'Password to check', placeholder: 'Type a password…', required: true },
    ],
    run: async (cfg) => {
      const p = cfg.password
      const checks = [
        [p.length >= 12, 'Length ≥12'],
        [/[A-Z]/.test(p), 'Uppercase letter'],
        [/[a-z]/.test(p), 'Lowercase letter'],
        [/[0-9]/.test(p), 'Number'],
        [/[^A-Za-z0-9]/.test(p), 'Special character'],
        [p.length >= 16, 'Length ≥16 (bonus)'],
      ] as [boolean, string][]
      const passed = checks.filter(([ok]) => ok)
      const score = passed.length
      const label = score <= 2 ? '🔴 Weak' : score <= 4 ? '🟡 Medium' : score <= 5 ? '🟢 Strong' : '💪 Very Strong'
      const details = checks.map(([ok, name]) => `${ok ? '✅' : '❌'} ${name}`).join(' · ')
      return `${label} (${score}/${checks.length}) · ${details}`
    },
  },
]
