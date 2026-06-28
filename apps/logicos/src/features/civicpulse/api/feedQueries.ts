// CivicPulse — Activity feed data fetching hooks

import { useState, useEffect, useCallback } from 'react'
import { civicpulseClient, getCivicPulseFailureMessage } from './civicpulseClient'
import type { FeedEntry, FeedFilters } from '../types/civicpulse.types'

export function useFeed(filters?: Partial<FeedFilters>) {
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchPage = useCallback(async (pageNum: number, reset = false) => {
    setLoading(true)
    setError(null)
    try {
      const data = await civicpulseClient.getFeed(filters, pageNum)
      setEntries(prev => reset ? data : [...prev, ...data])
      setHasMore(data.length > 0)
    } catch (error) {
      setError(getCivicPulseFailureMessage(error, 'activity feed'))
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(filters)]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(1)
    fetchPage(1, true)
  }, [fetchPage])

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    fetchPage(next)
  }

  return { entries, loading, error, hasMore, loadMore, refresh: () => fetchPage(1, true) }
}
