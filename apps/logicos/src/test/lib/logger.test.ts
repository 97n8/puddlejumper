import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '@/lib/logger'

describe('createLogger()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends structured error payloads to console.error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger('TestScope')
    const error = new Error('Boom')

    logger.error('Something failed.', error, { requestId: 'req-1' })

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      '[TestScope] Something failed.',
      expect.objectContaining({
        scope: 'TestScope',
        level: 'error',
        message: 'Something failed.',
        requestId: 'req-1',
        error: expect.objectContaining({
          name: 'Error',
          message: 'Boom',
        }),
      }),
    )
  })

  it('sends warning payloads to console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logger = createLogger('TestScope')

    logger.warn('Heads up.', { available: false })

    expect(warnSpy).toHaveBeenCalledWith(
      '[TestScope] Heads up.',
      expect.objectContaining({
        scope: 'TestScope',
        level: 'warn',
        message: 'Heads up.',
        available: false,
      }),
    )
  })
})
