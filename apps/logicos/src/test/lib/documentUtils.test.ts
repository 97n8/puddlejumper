import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateDocument, downloadBlob, extractPageStyles } from '@/lib/documentUtils'

describe('generateDocument — HTML format', () => {
  it('returns a Blob with type text/html', async () => {
    const blob = await generateDocument({ title: 'My Doc', content: 'Hello', format: 'html' })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/html')
  })

  it('HTML output contains the title', async () => {
    const blob = await generateDocument({ title: 'Test Title', content: 'Body', format: 'html' })
    const text = await blob.text()
    expect(text).toContain('Test Title')
  })

  it('HTML output contains the content', async () => {
    const blob = await generateDocument({ title: 'T', content: 'My content here', format: 'html' })
    const text = await blob.text()
    expect(text).toContain('My content here')
  })

  it('HTML escapes special characters in title', async () => {
    const blob = await generateDocument({ title: '<script>alert(1)</script>', content: '', format: 'html' })
    const text = await blob.text()
    expect(text).not.toContain('<script>')
    expect(text).toContain('&lt;script&gt;')
  })
})

describe('generateDocument — Markdown format', () => {
  it('returns a Blob with type text/markdown', async () => {
    const blob = await generateDocument({ title: 'My Doc', content: 'Hello', format: 'md' })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/markdown')
  })

  it('markdown output starts with # title', async () => {
    const blob = await generateDocument({ title: 'Hello World', content: 'Content', format: 'md' })
    const text = await blob.text()
    expect(text).toMatch(/^# Hello World/)
  })

  it('markdown output contains the content', async () => {
    const blob = await generateDocument({ title: 'T', content: 'My paragraphs', format: 'md' })
    const text = await blob.text()
    expect(text).toContain('My paragraphs')
  })
})

describe('generateDocument — PDF format', () => {
  it('returns a Blob with type application/pdf', async () => {
    const blob = await generateDocument({ title: 'PDF Doc', content: 'Content', format: 'pdf' })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
  })

  it('PDF output starts with %PDF header', async () => {
    const blob = await generateDocument({ title: 'Doc', content: 'Text', format: 'pdf' })
    const text = await blob.text()
    expect(text).toMatch(/^%PDF/)
  })
})

describe('generateDocument — DOCX format', () => {
  it('returns a Blob with the docx MIME type', async () => {
    const blob = await generateDocument({ title: 'My Doc', content: 'Hello docx', format: 'docx' })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })

  it('returns a non-empty Blob', async () => {
    const blob = await generateDocument({ title: 'Title', content: 'Some content here', format: 'docx' })
    expect(blob.size).toBeGreaterThan(0)
  })
})

describe('generateDocument — XLSX format', () => {
  it('returns a Blob with the xlsx MIME type', async () => {
    const blob = await generateDocument({ title: 'Sheet', content: 'col1\tcol2\nval1\tval2', format: 'xlsx' })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  })

  it('returns a non-empty Blob', async () => {
    const blob = await generateDocument({ title: 'Data', content: 'a\tb\nc\td', format: 'xlsx' })
    expect(blob.size).toBeGreaterThan(0)
  })
})

describe('generateDocument — default/unknown format', () => {
  it('falls back to plain text for unknown format', async () => {
    // @ts-expect-error testing unknown format
    const blob = await generateDocument({ title: 'T', content: 'plain text', format: 'unknown' })
    expect(blob).toBeInstanceOf(Blob)
    const text = await blob.text()
    expect(text).toBe('plain text')
  })
})

describe('downloadBlob', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>
  let revokeObjectURLMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURLMock = vi.fn().mockReturnValue('blob:fake-url')
    revokeObjectURLMock = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: createObjectURLMock, revokeObjectURL: revokeObjectURLMock })
  })

  it('creates an anchor, clicks it, and revokes the URL', () => {
    const clickMock = vi.fn()
    const appendChildMock = vi.spyOn(document.body, 'appendChild').mockImplementation((el) => {
      // Intercept click
      (el as HTMLAnchorElement).click = clickMock
      return el
    })
    const removeChildMock = vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el)

    const blob = new Blob(['data'], { type: 'text/plain' })
    downloadBlob(blob, 'test.txt')

    expect(createObjectURLMock).toHaveBeenCalledWith(blob)
    expect(clickMock).toHaveBeenCalled()
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:fake-url')

    appendChildMock.mockRestore()
    removeChildMock.mockRestore()
  })
})

describe('extractPageStyles', () => {
  it('returns an object with fontFamily, fontSize, color, backgroundColor', () => {
    const styles = extractPageStyles()
    expect(styles).toHaveProperty('fontFamily')
    expect(styles).toHaveProperty('fontSize')
    expect(styles).toHaveProperty('color')
    expect(styles).toHaveProperty('backgroundColor')
  })

  it('returns string values for each property', () => {
    const styles = extractPageStyles()
    expect(typeof styles.fontFamily).toBe('string')
    expect(typeof styles.fontSize).toBe('string')
    expect(typeof styles.color).toBe('string')
    expect(typeof styles.backgroundColor).toBe('string')
  })
})
