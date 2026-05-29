import React, { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'

export function SearchPicker({ value, onChange, load, renderItem, placeholder, emptyMsg }: {
  value: string
  onChange: (v: string) => void
  load: (q: string) => Promise<{ label: string; sub?: string; value: string; icon?: string }[]>
  renderItem?: (item: { label: string; sub?: string; value: string; icon?: string }) => React.ReactNode
  placeholder: string
  emptyMsg?: string
}) {
  const [search, setSearch] = useState(value || '')
  const [items, setItems] = useState<{ label: string; sub?: string; value: string; icon?: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (value && !search) setSearch(value)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function query(q: string) {
    setSearch(q); setOpen(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setLoading(true)
      try { setItems(await load(q)) } catch { setItems([]) }
      finally { setLoading(false) }
    }, 300)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { query('') }, [])

  function select(item: { label: string; value: string }) {
    onChange(item.value)
    setSearch(item.label)
    setOpen(false)
  }

  return (
    <div className="relative">
      <Input value={search} onChange={e => query(e.target.value)}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={loading ? 'Loading…' : placeholder} className="text-sm" />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {items.slice(0, 30).map(item => (
            <button key={item.value} type="button" onMouseDown={() => select(item)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-left">
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <div className="min-w-0">
                <div className="truncate">{renderItem ? renderItem(item) : item.label}</div>
                {item.sub && <div className="text-[10px] text-muted-foreground truncate">{item.sub}</div>}
              </div>
            </button>
          ))}
          {items.length === 0 && !loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">{emptyMsg ?? 'No results'}</div>
          )}
        </div>
      )}
    </div>
  )
}
