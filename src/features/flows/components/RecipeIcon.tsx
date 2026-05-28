import {
  Lightning, WindowsLogo, GoogleLogo, GithubLogo, Cloud, Shield,
  Lock, Code, Envelope, CalendarBlank, ListBullets,
  Link, FolderOpen, ChatCircle, CheckSquare, MagnifyingGlass,
  Buildings,
} from '@phosphor-icons/react'

export function RecipeIcon({ connection, id, size = 16 }: { connection?: string; id?: string; size?: number }) {
  const cls = 'shrink-0 text-muted-foreground'
  const conn = connection ?? (
    id?.startsWith('ms-') ? 'microsoft' :
    id?.startsWith('g-') ? 'google' :
    id?.startsWith('gh-') ? 'github' :
    id?.startsWith('cp-') ? 'civicplus' :
    undefined
  )
  if (conn === 'microsoft') return <WindowsLogo size={size} className={cls} />
  if (conn === 'google')    return <GoogleLogo size={size} className={cls} />
  if (conn === 'github')    return <GithubLogo size={size} className={cls} />
  if (conn === 'civicplus') return <Buildings size={size} className={cls} />
  if (connection === 'logicsuite') return <Cloud size={size} className={cls} />
  if (id?.startsWith('vault-'))  return <Shield size={size} className={cls} />
  if (id?.startsWith('cloud-'))  return <Cloud size={size} className={cls} />
  if (id?.includes('password') || id?.includes('hash') || id?.includes('breach') || id?.includes('base64')) return <Lock size={size} className={cls} />
  if (id?.includes('json') || id?.includes('csv') || id?.includes('xml')) return <Code size={size} className={cls} />
  if (id?.includes('email') || id?.includes('mail')) return <Envelope size={size} className={cls} />
  if (id?.includes('calendar') || id?.includes('time') || id?.includes('cron') || id?.includes('timestamp')) return <CalendarBlank size={size} className={cls} />
  if (id?.includes('uuid') || id?.includes('sort') || id?.includes('dedupe') || id?.includes('case')) return <ListBullets size={size} className={cls} />
  if (id?.includes('url') || id?.includes('link')) return <Link size={size} className={cls} />
  if (id?.includes('file') || id?.includes('drive') || id?.includes('storage') || id?.includes('share')) return <FolderOpen size={size} className={cls} />
  if (id?.includes('channel') || id?.includes('team') || id?.includes('message') || id?.includes('post')) return <ChatCircle size={size} className={cls} />
  if (id?.includes('task') || id?.includes('plan') || id?.includes('todo')) return <CheckSquare size={size} className={cls} />
  if (id?.includes('gitignore') || id?.includes('regex') || id?.includes('text') || id?.includes('word') || id?.includes('find')) return <MagnifyingGlass size={size} className={cls} />
  return <Lightning size={size} className={cls} />
}
