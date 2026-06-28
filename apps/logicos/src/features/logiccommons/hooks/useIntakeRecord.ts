import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pjBase } from '@/services/pjBase'

export class IntakeRecordApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'IntakeRecordApiError'
  }
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const raw = await res.text().catch(() => '')
  if (!raw) return fallback

  try {
    const parsed = JSON.parse(raw) as { error?: string; message?: string }
    return parsed.message ?? parsed.error ?? raw
  } catch {
    return raw
  }
}

async function fetchRecord(recordId: string) {
  const res = await fetch(`${pjBase}/api/v1/commons/intake/${recordId}`, {
    credentials: 'include',
    headers: { 'x-puddlejumper-request': 'true' },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new IntakeRecordApiError(
      res.status,
      await readErrorMessage(res, 'Failed to load record'),
    )
  }
  return res.json()
}

async function fetchRecords(moduleKey: string) {
  const url = new URL(`${pjBase}/api/v1/commons/records`)
  url.searchParams.set('module_key', moduleKey)
  const res = await fetch(url.toString(), {
    credentials: 'include',
    headers: { 'x-puddlejumper-request': 'true' },
  })
  if (!res.ok) {
    throw new IntakeRecordApiError(
      res.status,
      await readErrorMessage(res, 'Failed to load records'),
    )
  }
  return res.json()
}

export function useIntakeRecord(recordId: string | undefined) {
  const query = useQuery({
    queryKey: ['commons', 'record', recordId],
    queryFn: () => fetchRecord(recordId!),
    enabled: !!recordId,
    staleTime: 30_000,
  })

  const retry = async () => {
    await query.refetch()
  }

  if (query.isLoading) {
    return { status: 'loading' as const, retry }
  }

  if (query.data === null) {
    return { status: 'not_found' as const, retry }
  }

  if (query.isError) {
    const error = query.error
    if (error instanceof IntakeRecordApiError && error.status === 401) {
      return {
        status: 'unauthenticated' as const,
        message: error.message,
        retry,
      }
    }
    if (error instanceof IntakeRecordApiError && error.status === 403) {
      return {
        status: 'unauthorized' as const,
        message: error.message,
        retry,
      }
    }
    return {
      status: 'load_error' as const,
      message: error instanceof Error ? error.message : 'Failed to load record',
      retry,
    }
  }

  return {
    status: 'ok' as const,
    record: query.data,
    retry,
  }
}

export function useRecordsList(moduleKey: string) {
  return useQuery({
    queryKey: ['commons', 'records', moduleKey],
    queryFn: () => fetchRecords(moduleKey),
    staleTime: 30_000,
  })
}

export function useCreateIntakeRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`${pjBase}/api/v1/commons/intake`, {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-puddlejumper-request': 'true' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error ?? 'Failed to create record')
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commons', 'records'] }),
  })
}

export function useSeedDemoData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${pjBase}/api/v1/commons/seed`, {
        method: 'POST', credentials: 'include',
        headers: { 'x-puddlejumper-request': 'true' },
      })
      if (!res.ok) throw new Error('Seed failed')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commons', 'records'] })
      qc.invalidateQueries({ queryKey: ['commons', 'alerts'] })
    },
  })
}
