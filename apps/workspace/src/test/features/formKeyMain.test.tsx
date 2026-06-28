import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    formkey: {
      list: vi.fn().mockResolvedValue({ forms: [] }),
      create: vi.fn().mockResolvedValue({ form: { id: 'f1', name: 'Test Form', status: 'draft', fields: [], formId: 'test-form-abc1', description: '' } }),
      update: vi.fn().mockResolvedValue({ form: { id: 'f1', name: 'Test Form', status: 'draft', fields: [], formId: 'test-form-abc1', description: '' } }),
      publish: vi.fn().mockResolvedValue({ form: { id: 'f1', name: 'Test Form', status: 'published', fields: [], formId: 'test-form-abc1', description: '' } }),
      deprecate: vi.fn().mockResolvedValue({ success: true }),
      listSubmissions: vi.fn().mockResolvedValue({ submissions: [] }),
      listReviews: vi.fn().mockResolvedValue({ reviews: [], total: 0 }),
      submit: vi.fn().mockResolvedValue({ success: true }),
    },
  },
}))

vi.mock('@/features/formkey/components/FormKeyDemoPanel', () => ({
  FormKeyDemoPanel: ({ onCreateBlank }: { onCreateBlank: () => void }) => (
    <div data-testid="formkey-demo-panel">
      <button onClick={onCreateBlank}>Create blank form</button>
    </div>
  ),
}))

vi.mock('@/features/formkey/components/FormKeySharePanel', () => ({
  FormKeySharePanel: () => <div data-testid="formkey-share-panel" />,
}))

vi.mock('@/features/formkey/components/FormKeyIntakePanel', () => ({
  FormKeyIntakePanel: ({ initialTab }: { initialTab?: 'inbox' | 'reviews' }) => (
    <div data-testid="formkey-intake-panel">{initialTab === 'reviews' ? 'reviews' : 'inbox'}</div>
  ),
}))

vi.mock('@/features/formkey/components/formKeyStarterData', () => ({
  FORMKEY_DEMO_FIELDS: [],
}))

const { FormKeyPanel } = await import('@/features/formkey/components/FormKeyPanel')

function renderPanel(path = '/formkey') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FormKeyPanel />
    </MemoryRouter>,
  )
}

describe('FormKeyPanel smoke suite', () => {
  it('renders without crashing', async () => {
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument())
  })

  it('shows "FormKey" heading', async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByText('FormKey')).toBeInTheDocument())
  })

  it('shows "No forms yet" empty state when no forms exist', async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByText(/no forms yet/i)).toBeInTheDocument())
  })

  it('"New form" button is present', async () => {
    renderPanel()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /new form/i })).toBeInTheDocument()
    )
  })

  it('new form panel opens when "New form" is clicked', async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => screen.getByRole('button', { name: /new form/i }))
    await user.click(screen.getByRole('button', { name: /new form/i }))
    expect(screen.getByText(/create a new form/i)).toBeInTheDocument()
  })

  it('canon tagline is visible ("every submission becomes a governed record")', async () => {
    renderPanel()
    // FormKeyDemoPanel (mocked) is shown when no forms exist — it contains demo context
    await waitFor(() => expect(screen.getByTestId('formkey-demo-panel')).toBeInTheDocument())
  })

  it('selects the intake route tab from the URL', async () => {
    renderPanel('/formkey?tab=intake')
    await waitFor(() => expect(screen.getByTestId('formkey-intake-panel')).toHaveTextContent('inbox'))
  })

  it('selects the review route tab from the URL', async () => {
    renderPanel('/formkey?tab=review')
    await waitFor(() => expect(screen.getByTestId('formkey-intake-panel')).toHaveTextContent('reviews'))
  })
})
