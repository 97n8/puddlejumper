import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKV } from '@/hooks/useKV'

// Use a fresh localStorage-like store per test
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { for (const k in store) delete store[k] }),
  length: 0,
  key: vi.fn(),
}

Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

describe('useKV', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('returns the default value when localStorage is empty', () => {
    const { result } = renderHook(() => useKV('test-key', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('reads an existing value from localStorage on mount', () => {
    store['existing-key'] = JSON.stringify('stored-value')
    const { result } = renderHook(() => useKV('existing-key', 'default'))
    expect(result.current[0]).toBe('stored-value')
  })

  it('setting value persists it to localStorage', () => {
    const { result } = renderHook(() => useKV('write-key', 0))
    act(() => { result.current[1](42) })
    expect(result.current[0]).toBe(42)
    expect(localStorageMock.setItem).toHaveBeenCalledWith('write-key', '42')
  })

  it('functional update receives previous value', () => {
    const { result } = renderHook(() => useKV('counter', 10))
    act(() => { result.current[1]((prev) => prev + 5) })
    expect(result.current[0]).toBe(15)
  })

  it('works with object values', () => {
    const defaultVal = { name: 'Alice', age: 30 }
    const { result } = renderHook(() => useKV('obj-key', defaultVal))
    act(() => { result.current[1]({ name: 'Bob', age: 25 }) })
    expect(result.current[0]).toEqual({ name: 'Bob', age: 25 })
  })

  it('works with array values', () => {
    const { result } = renderHook(() => useKV('arr-key', [] as string[]))
    act(() => { result.current[1](['a', 'b', 'c']) })
    expect(result.current[0]).toEqual(['a', 'b', 'c'])
  })

  it('two hooks with different keys are independent', () => {
    const { result: r1 } = renderHook(() => useKV('key-a', 'a'))
    const { result: r2 } = renderHook(() => useKV('key-b', 'b'))
    act(() => { r1.current[1]('A') })
    expect(r1.current[0]).toBe('A')
    expect(r2.current[0]).toBe('b')
  })

  it('returns default when localStorage contains invalid JSON', () => {
    store['bad-json'] = 'not-valid-json{'
    const { result } = renderHook(() => useKV('bad-json', 'fallback'))
    expect(result.current[0]).toBe('fallback')
  })
})
