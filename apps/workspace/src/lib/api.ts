// Central API client — all PuddleJumper calls go through pjFetch
// Never call fetch() directly in components; use this or pjApi.ts for provider proxying.

import { pjBase } from '@/services/pjBase'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function pjFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${pjBase}/api${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(
      res.status,
      (body as { errors?: Array<{ message: string }> })?.errors?.[0]?.message ??
        'Request failed',
    )
  }

  const body = (await res.json()) as { data: T }
  return body.data
}
