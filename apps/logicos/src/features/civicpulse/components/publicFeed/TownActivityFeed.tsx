import { useState } from 'react'
import { FeedEntry } from './FeedEntry'
import { FeedFilter } from './FeedFilter'
import { FeedSearch } from './FeedSearch'
import { useFeed } from '../../api/feedQueries'
import { Button } from '@/components/ui/button'
import { CircleNotch, ArrowClockwise } from '@phosphor-icons/react'
import type { ActionType } from '../../types/civicpulse.types'

export function TownActivityFeed() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<ActionType[]>([])

  const { entries, loading, error, hasMore, loadMore, refresh } = useFeed({
    searchQuery,
    actionTypes: selectedTypes,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Town Activity Feed</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Live public governance record — built from VAULT, maintained by CivicPulse.</p>
        </div>
        <Button size="sm" variant="ghost" className="gap-1.5 shrink-0" onClick={refresh} disabled={loading}>
          <ArrowClockwise size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      <FeedSearch value={searchQuery} onChange={setSearchQuery} />
      <FeedFilter selected={selectedTypes} onChange={setSelectedTypes} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-3">
        {entries.map(entry => (
          <FeedEntry key={entry.id} entry={entry} />
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-6">
          <CircleNotch size={16} className="animate-spin" />
          <span className="text-sm">Loading feed…</span>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No governance actions published yet.</p>
          {(searchQuery || selectedTypes.length > 0) && (
            <p className="text-xs mt-1">Try adjusting your filters.</p>
          )}
        </div>
      )}

      {!loading && hasMore && entries.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button size="sm" variant="outline" onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
