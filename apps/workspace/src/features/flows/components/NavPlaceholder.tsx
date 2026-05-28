export function NavPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      {label} — coming soon
    </div>
  )
}
