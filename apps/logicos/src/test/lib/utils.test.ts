import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn()', () => {
  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('merges multiple classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes (falsy ignored)', () => {
    expect(cn('foo', (false as boolean) && 'bar', undefined, null, 'baz')).toBe('foo baz')
  })

  it('resolves tailwind conflicts — last wins', () => {
    // twMerge should resolve p-2 vs p-4 to p-4
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('resolves conflicting text-color utilities', () => {
    expect(cn('text-red-500', 'text-blue-600')).toBe('text-blue-600')
  })

  it('handles object syntax from clsx', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  it('handles array syntax from clsx', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })

  it('handles only falsy values', () => {
    expect(cn(false, undefined, null)).toBe('')
  })

  it('deduplicates by resolving tailwind conflicts', () => {
    // bg-red and bg-blue conflict — last wins
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })
})
