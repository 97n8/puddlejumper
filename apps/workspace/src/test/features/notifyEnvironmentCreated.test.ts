import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notifyEnvironmentCreated } from '@/features/environments/utils/notifyEnvironmentCreated'

// Mock pjApi
vi.mock('@/services/pjApi', () => ({
  pjApi: {
    microsoft: { post: vi.fn() },
    google:    { post: vi.fn() },
  },
}))

import { pjApi } from '@/services/pjApi'

describe('notifyEnvironmentCreated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when userEmail is null', async () => {
    await notifyEnvironmentCreated({ envName: 'Test', envId: 'test-id', userEmail: null })
    expect(pjApi.microsoft.post).not.toHaveBeenCalled()
    expect(pjApi.google.post).not.toHaveBeenCalled()
  })

  it('does nothing when userEmail is undefined', async () => {
    await notifyEnvironmentCreated({ envName: 'Test', envId: 'test-id' })
    expect(pjApi.microsoft.post).not.toHaveBeenCalled()
  })

  it('sends via Microsoft Graph when connected', async () => {
    vi.mocked(pjApi.microsoft.post).mockResolvedValue(null)
    await notifyEnvironmentCreated({
      envName: 'Town of Logicville',
      envId: 'vault-logicville',
      moduleIds: ['VAULTPRR', 'VAULTCLERK'],
      userEmail: 'clerk@logicville.gov',
      userName: 'Jane Doe',
    })
    expect(pjApi.microsoft.post).toHaveBeenCalledWith('me/sendMail', expect.objectContaining({
      message: expect.objectContaining({
        subject: expect.stringContaining('Town of Logicville'),
        body: expect.objectContaining({ contentType: 'HTML' }),
        toRecipients: [{ emailAddress: { address: 'clerk@logicville.gov' } }],
      }),
    }))
    // Should NOT fall through to Gmail
    expect(pjApi.google.post).not.toHaveBeenCalled()
  })

  it('falls through to Gmail when Microsoft throws', async () => {
    vi.mocked(pjApi.microsoft.post).mockRejectedValue(new Error('not connected'))
    vi.mocked(pjApi.google.post).mockResolvedValue(null)
    await notifyEnvironmentCreated({
      envName: 'Town of Phillipston',
      envId: 'vault-phillipston-prr',
      moduleIds: ['VAULTPRR'],
      userEmail: 'clerk@phillipston-ma.gov',
    })
    expect(pjApi.google.post).toHaveBeenCalledWith(
      'gmail/v1/users/me/messages/send',
      expect.objectContaining({ raw: expect.any(String) }),
    )
  })

  it('silently swallows errors when neither provider is connected', async () => {
    vi.mocked(pjApi.microsoft.post).mockRejectedValue(new Error('401'))
    vi.mocked(pjApi.google.post).mockRejectedValue(new Error('401'))
    await expect(
      notifyEnvironmentCreated({
        envName: 'Test Env',
        envId: 'test-env',
        userEmail: 'user@example.com',
      }),
    ).resolves.toBeUndefined()
  })

  it('includes module labels in the HTML body', async () => {
    vi.mocked(pjApi.microsoft.post).mockResolvedValue(null)
    await notifyEnvironmentCreated({
      envName: 'Test',
      envId: 'test',
      moduleIds: ['VAULTPRR', 'VAULTMEET'],
      userEmail: 'test@example.com',
    })
    const call = vi.mocked(pjApi.microsoft.post).mock.calls[0]
    const html: string = (call[1] as { message: { body: { content: string } } }).message.body.content
    expect(html).toContain('Public Records Requests')
    expect(html).toContain('Board Meetings')
  })
})
