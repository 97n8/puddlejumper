import { describe, it, expect } from 'vitest'
import {
  getFileExtension,
  getFileType,
  formatFileSize,
  getFileBadgeClass,
  generateUniqueFileName,
} from '@/lib/fileUtils'

describe('getFileExtension', () => {
  it('returns extension for simple filename', () => {
    expect(getFileExtension('report.pdf')).toBe('pdf')
  })
  it('returns extension lowercased', () => {
    expect(getFileExtension('Image.PNG')).toBe('png')
  })
  it('returns empty string when no extension', () => {
    expect(getFileExtension('Makefile')).toBe('')
  })
  it('returns last extension for multiple dots', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz')
  })
})

describe('getFileType', () => {
  it('maps .pdf to pdf', () => expect(getFileType('doc.pdf')).toBe('pdf'))
  it('maps .doc to docx', () => expect(getFileType('file.doc')).toBe('docx'))
  it('maps .docx to docx', () => expect(getFileType('file.docx')).toBe('docx'))
  it('maps .xls to xlsx', () => expect(getFileType('data.xls')).toBe('xlsx'))
  it('maps .xlsx to xlsx', () => expect(getFileType('data.xlsx')).toBe('xlsx'))
  it('maps .csv to csv', () => expect(getFileType('data.csv')).toBe('csv'))
  it('maps .md to md', () => expect(getFileType('readme.md')).toBe('md'))
  it('maps .markdown to md', () => expect(getFileType('readme.markdown')).toBe('md'))
  it('maps .json to json', () => expect(getFileType('config.json')).toBe('json'))
  it('maps .html to html', () => expect(getFileType('index.html')).toBe('html'))
  it('maps .htm to html', () => expect(getFileType('index.htm')).toBe('html'))
  it('maps .txt to txt', () => expect(getFileType('note.txt')).toBe('txt'))
  it('maps .png to png', () => expect(getFileType('img.png')).toBe('png'))
  it('maps .jpg to jpg', () => expect(getFileType('img.jpg')).toBe('jpg'))
  it('maps .svg to svg', () => expect(getFileType('icon.svg')).toBe('svg'))
  it('falls back to txt for unknown extension', () => expect(getFileType('file.xyz')).toBe('txt'))
  it('falls back to txt for no extension', () => expect(getFileType('Makefile')).toBe('txt'))
})

describe('formatFileSize', () => {
  it('shows bytes for < 1024', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })
  it('shows KB for < 1MB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
  })
  it('shows KB with decimals', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })
  it('shows MB for >= 1MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
  })
  it('shows MB with decimals', () => {
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })
})

describe('getFileBadgeClass', () => {
  it('returns pdf class for pdf', () => {
    expect(getFileBadgeClass('pdf')).toBe('file-badge-pdf')
  })
  it('returns docx class for docx', () => {
    expect(getFileBadgeClass('docx')).toBe('file-badge-docx')
  })
  it('returns xlsx class for xlsx', () => {
    expect(getFileBadgeClass('xlsx')).toBe('file-badge-xlsx')
  })
  it('returns csv class for csv', () => {
    expect(getFileBadgeClass('csv')).toBe('file-badge-csv')
  })
  it('returns md class for md', () => {
    expect(getFileBadgeClass('md')).toBe('file-badge-md')
  })
  it('returns json class for json', () => {
    expect(getFileBadgeClass('json')).toBe('file-badge-json')
  })
  it('returns default class for html', () => {
    expect(getFileBadgeClass('html')).toBe('file-badge-default')
  })
  it('returns default class for png', () => {
    expect(getFileBadgeClass('png')).toBe('file-badge-default')
  })
})

describe('generateUniqueFileName', () => {
  it('returns original name when no conflict', () => {
    expect(generateUniqueFileName('report.pdf', [])).toBe('report.pdf')
    expect(generateUniqueFileName('report.pdf', ['other.pdf'])).toBe('report.pdf')
  })
  it('appends -1 when name conflicts', () => {
    expect(generateUniqueFileName('report.pdf', ['report.pdf'])).toBe('report-1.pdf')
  })
  it('increments counter until unique', () => {
    expect(generateUniqueFileName('report.pdf', ['report.pdf', 'report-1.pdf'])).toBe('report-2.pdf')
  })
  it('handles files without extension', () => {
    expect(generateUniqueFileName('Makefile', ['Makefile'])).toBe('Makefile-1')
  })
  it('handles multiple conflicts', () => {
    const existing = ['data.csv', 'data-1.csv', 'data-2.csv', 'data-3.csv']
    expect(generateUniqueFileName('data.csv', existing)).toBe('data-4.csv')
  })
})
