import { describe, it, expect } from 'vitest'
import type {
  ToolKey,
  DocumentFormat,
  FileType,
  UserRole,
  AutomationTrigger,
  HTTPMethod,
} from '@/lib/types'

// Type-level compile-time tests — if these don't compile, the type is wrong.
// The `satisfies` operator validates without widening.
const VAULT: ToolKey = 'vault'
const ADMIN: ToolKey = 'admin'
const LOGICDASH: ToolKey = 'logicdash'
const FORMKEY: ToolKey = 'formkey'

describe('ToolKey type', () => {
  it('includes vault', () => { expect(VAULT).toBe('vault') })
  it('includes admin', () => { expect(ADMIN).toBe('admin') })
  it('includes logicdash', () => { expect(LOGICDASH).toBe('logicdash') })
  it('includes formkey', () => { expect(FORMKEY).toBe('formkey') })
})

const DOCX: DocumentFormat = 'docx'
const PDF: DocumentFormat = 'pdf'
const HTML: DocumentFormat = 'html'
const MD: DocumentFormat = 'md'

describe('DocumentFormat type', () => {
  it('includes docx', () => { expect(DOCX).toBe('docx') })
  it('includes pdf', () => { expect(PDF).toBe('pdf') })
  it('includes html', () => { expect(HTML).toBe('html') })
  it('includes md', () => { expect(MD).toBe('md') })
})

const PNG: FileType = 'png'
const CSV: FileType = 'csv'

describe('FileType type', () => {
  it('includes png', () => { expect(PNG).toBe('png') })
  it('includes csv', () => { expect(CSV).toBe('csv') })
})

const OWNER: UserRole = 'owner'
const ADMIN_ROLE: UserRole = 'admin'
const MEMBER: UserRole = 'member'
const VIEWER: UserRole = 'viewer'

describe('UserRole type', () => {
  it('includes owner', () => { expect(OWNER).toBe('owner') })
  it('includes admin', () => { expect(ADMIN_ROLE).toBe('admin') })
  it('includes member', () => { expect(MEMBER).toBe('member') })
  it('includes viewer', () => { expect(VIEWER).toBe('viewer') })
})

const MANUAL: AutomationTrigger = 'manual'
const TIME: AutomationTrigger = 'time_interval'

describe('AutomationTrigger type', () => {
  it('includes manual', () => { expect(MANUAL).toBe('manual') })
  it('includes time_interval', () => { expect(TIME).toBe('time_interval') })
})

const GET: HTTPMethod = 'GET'
const POST: HTTPMethod = 'POST'
const DELETE: HTTPMethod = 'DELETE'

describe('HTTPMethod type', () => {
  it('includes GET', () => { expect(GET).toBe('GET') })
  it('includes POST', () => { expect(POST).toBe('POST') })
  it('includes DELETE', () => { expect(DELETE).toBe('DELETE') })
})
