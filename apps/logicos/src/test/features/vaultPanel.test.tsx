import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/auth/AuthContext', () => ({
  useAuth: () => ({ user: { sub: 'u1', email: 'test@example.com', name: 'Test User' } }),
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    docs: {
      list: vi.fn().mockResolvedValue({ documents: [] }),
      get: vi.fn().mockResolvedValue(null),
      getAudit: vi.fn().mockResolvedValue({ events: [], signatures: [] }),
      getVersions: vi.fn().mockResolvedValue({ versions: [] }),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      setStatus: vi.fn().mockResolvedValue({}),
      setClassification: vi.fn().mockResolvedValue({}),
      addSignature: vi.fn().mockResolvedValue({}),
    },
    vaultFiles: {
      list: vi.fn().mockResolvedValue({ files: [] }),
      upload: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      getPreview: vi.fn().mockResolvedValue({}),
    },
    cloudSave: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Separator: () => <div />,
}))

vi.mock('@uiw/react-codemirror', () => ({
  default: () => <div data-testid="codemirror" />,
}))

vi.mock('@codemirror/lang-html', () => ({ html: () => [] }))
vi.mock('@codemirror/lang-css', () => ({ css: () => [] }))
vi.mock('@codemirror/theme-one-dark', () => ({ oneDark: [] }))

vi.mock('@/components/SaveToCloudDialog', () => ({
  SaveToCloudDialog: () => null,
}))

const { VaultPanel } = await import('@/components/VaultPanel')

describe('VaultPanel smoke suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('renders without crashing', () => {
    render(<VaultPanel />)
    expect(document.body).toBeTruthy()
  })

  it('shows VAULT branding in header (may appear multiple times)', () => {
    render(<VaultPanel />)
    expect(screen.getAllByText('VAULT').length).toBeGreaterThan(0)
  })

  it('shows "Audited Docs" badge', () => {
    render(<VaultPanel />)
    expect(screen.getByText(/Audited Docs/i)).toBeInTheDocument()
  })

  it('shows Documents and Files library tabs', () => {
    render(<VaultPanel />)
    expect(screen.getByRole('button', { name: /documents/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /files/i })).toBeInTheDocument()
  })
})
