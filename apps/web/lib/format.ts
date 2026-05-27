// Small formatting helpers — kept tiny so they stay obvious at the call site.

export function fmtAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return '1d';
  return `${days}d`;
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Human-readable summary for an audit_events row. */
export function audit_summary(eventType: string): string {
  switch (eventType) {
    case 'process.created':         return 'Process created';
    case 'process.fields_updated':  return 'Fields updated';
    case 'process.closed':          return 'Process closed';
    case 'transition.fired':        return 'State advanced';
    case 'transition.refused':      return 'Transition refused';
    case 'role.assigned':           return 'Role assigned';
    case 'role.changed':            return 'Role changed';
    case 'role.unassigned':         return 'Role unassigned';
    case 'role.deactivated':        return 'Identity deactivated';
    case 'auth.granted':            return 'Permission granted';
    case 'auth.refused':            return 'Permission refused';
    case 'divergence.manifest_loaded':  return 'Overlay loaded';
    case 'divergence.manifest_changed': return 'Overlay changed';
    case 'divergence.binding_exercised':return 'Binding exercised';
    case 'system.intent_dispatched':    return 'Intent dispatched';
    default: return eventType;
  }
}
