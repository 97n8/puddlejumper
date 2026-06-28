import { describe, it, expect } from 'vitest'
import {
  generateFullDisclosureLetter,
  generatePartialDisclosureLetter,
  generateDenialLetter,
  generateExtensionLetter,
} from '@/features/vault/utils/generateFormTemplates'

const baseCtx = {
  town: 'Sutton',
  caseNumber: 'PRR-2026-042',
  requesterName: 'Jane Doe',
  requesterEmail: 'jane@example.com',
  raoName: 'John Smith',
  raoTitle: 'Records Access Officer',
  raoEmail: 'rao@sutton.gov',
  raoPhone: '(508) 555-0100',
  today: 'April 7, 2026',
  requestDescription: 'All vendor contracts FY2024',
}

// ── generateFullDisclosureLetter ──────────────────────────────────────────────

describe('generateFullDisclosureLetter', () => {
  it('returns a non-empty HTML string', () => {
    const html = generateFullDisclosureLetter(baseCtx)
    expect(html).toBeTruthy()
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('contains the case number in the output', () => {
    const html = generateFullDisclosureLetter(baseCtx)
    expect(html).toContain('PRR-2026-042')
  })

  it('contains the requestor name', () => {
    const html = generateFullDisclosureLetter(baseCtx)
    expect(html).toContain('Jane Doe')
  })

  it('contains the town name', () => {
    const html = generateFullDisclosureLetter(baseCtx)
    expect(html).toContain('Sutton')
  })

  it('contains required M.G.L. c. 66 §10 legal citation', () => {
    const html = generateFullDisclosureLetter(baseCtx)
    expect(html).toContain('M.G.L. c. 66')
  })

  it('contains 90 calendar days appeal language', () => {
    const html = generateFullDisclosureLetter(baseCtx)
    expect(html).toContain('90 calendar days')
  })

  it('contains RAO name and title in signature block', () => {
    const html = generateFullDisclosureLetter(baseCtx)
    expect(html).toContain('John Smith')
    expect(html).toContain('Records Access Officer')
  })

  it('contains the request description when provided', () => {
    const html = generateFullDisclosureLetter(baseCtx)
    expect(html).toContain('All vendor contracts FY2024')
  })

  it('contains diligent search language (required by MA PRR law)', () => {
    const html = generateFullDisclosureLetter(baseCtx)
    expect(html.toLowerCase()).toContain('diligent search')
  })

  it('contains appeal rights information mentioning Supervisor of Public Records', () => {
    const html = generateFullDisclosureLetter(baseCtx)
    expect(html).toContain('Supervisor of Public Records')
  })

  it('includes the date provided in context', () => {
    const html = generateFullDisclosureLetter(baseCtx)
    expect(html).toContain('April 7, 2026')
  })

  it('falls back to [Requester Address] when no email provided', () => {
    const html = generateFullDisclosureLetter({ ...baseCtx, requesterEmail: undefined })
    expect(html).toContain('[Requester Address]')
  })
})

// ── generateDenialLetter ──────────────────────────────────────────────────────

describe('generateDenialLetter', () => {
  const exemptions = [
    'Exemption (b) — Personnel/medical files',
    'Exemption (c) — Inter-agency deliberative process',
  ]

  it('returns valid HTML containing DOCTYPE', () => {
    const html = generateDenialLetter(baseCtx, exemptions)
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('contains "Denial" in the document title', () => {
    const html = generateDenialLetter(baseCtx, exemptions)
    expect(html).toContain('Denial')
  })

  it('contains the case number', () => {
    const html = generateDenialLetter(baseCtx, exemptions)
    expect(html).toContain('PRR-2026-042')
  })

  it('contains denial language (unable to produce)', () => {
    const html = generateDenialLetter(baseCtx, exemptions)
    expect(html.toLowerCase()).toContain('unable to produce')
  })

  it('lists each exemption in the output', () => {
    const html = generateDenialLetter(baseCtx, exemptions)
    expect(html).toContain('Exemption (b) — Personnel/medical files')
    expect(html).toContain('Exemption (c) — Inter-agency deliberative process')
  })

  it('cites M.G.L. c. 4 §7(26) exemptions', () => {
    const html = generateDenialLetter(baseCtx, exemptions)
    expect(html).toContain('M.G.L. c. 4')
  })

  it('contains 90-day appeal language', () => {
    const html = generateDenialLetter(baseCtx, exemptions)
    expect(html).toContain('90 calendar days')
  })

  it('contains appeal address (Secretary of State)', () => {
    const html = generateDenialLetter(baseCtx, exemptions)
    expect(html).toContain('Secretary of State')
  })

  it('contains the requestor name', () => {
    const html = generateDenialLetter(baseCtx, exemptions)
    expect(html).toContain('Jane Doe')
  })

  it('works with empty exemptions list', () => {
    const html = generateDenialLetter(baseCtx, [])
    expect(html).toContain('Denial')
    expect(html).toContain('PRR-2026-042')
  })
})

// ── generateExtensionLetter ───────────────────────────────────────────────────

describe('generateExtensionLetter', () => {
  it('returns valid HTML', () => {
    const html = generateExtensionLetter(baseCtx)
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('contains "Extension" in the document title', () => {
    const html = generateExtensionLetter(baseCtx)
    expect(html).toContain('Extension')
  })

  it('contains the case number', () => {
    const html = generateExtensionLetter(baseCtx)
    expect(html).toContain('PRR-2026-042')
  })

  it('contains "Time Extension" language in RE line', () => {
    const html = generateExtensionLetter(baseCtx)
    expect(html).toContain('Time Extension')
  })

  it('uses provided extensionDays in output', () => {
    const html = generateExtensionLetter({ ...baseCtx, extensionDays: 15 })
    expect(html).toContain('15')
  })

  it('defaults to 10 business days when extensionDays not provided', () => {
    const html = generateExtensionLetter(baseCtx)
    expect(html).toContain('10')
  })

  it('contains the requestor name', () => {
    const html = generateExtensionLetter(baseCtx)
    expect(html).toContain('Jane Doe')
  })

  it('contains town name', () => {
    const html = generateExtensionLetter(baseCtx)
    expect(html).toContain('Sutton')
  })

  it('mentions M.G.L. c. 66 §10', () => {
    const html = generateExtensionLetter(baseCtx)
    expect(html).toContain('M.G.L. c. 66')
  })
})

// ── generatePartialDisclosureLetter ──────────────────────────────────────────

describe('generatePartialDisclosureLetter', () => {
  const exemptions = ['Exemption (a) — Trade secrets', 'Exemption (d) — Attorney-client privilege']

  it('returns valid HTML', () => {
    const html = generatePartialDisclosureLetter(baseCtx, exemptions)
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('contains "Partial Disclosure" in the title', () => {
    const html = generatePartialDisclosureLetter(baseCtx, exemptions)
    expect(html).toContain('Partial Disclosure')
  })

  it('contains the case number', () => {
    const html = generatePartialDisclosureLetter(baseCtx, exemptions)
    expect(html).toContain('PRR-2026-042')
  })

  it('lists all provided exemptions', () => {
    const html = generatePartialDisclosureLetter(baseCtx, exemptions)
    expect(html).toContain('Exemption (a) — Trade secrets')
    expect(html).toContain('Exemption (d) — Attorney-client privilege')
  })

  it('contains "in part" partial delivery language', () => {
    const html = generatePartialDisclosureLetter(baseCtx, exemptions)
    expect(html).toContain('in part')
  })

  it('cites M.G.L. c. 4 §7(26) exemptions', () => {
    const html = generatePartialDisclosureLetter(baseCtx, exemptions)
    expect(html).toContain('M.G.L. c. 4')
  })

  it('contains 90-day appeal language', () => {
    const html = generatePartialDisclosureLetter(baseCtx, exemptions)
    expect(html).toContain('90 calendar days')
  })

  it('contains the requestor name in the salutation', () => {
    const html = generatePartialDisclosureLetter(baseCtx, exemptions)
    expect(html).toContain('Jane Doe')
  })
})
