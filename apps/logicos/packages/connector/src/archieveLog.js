/**
 * Writes package_id before every AI call.
 * No unlogged call is ever made.
 */
const log = [];

export function logBeforeAICall({ package_id, actor, jurisdiction_id }) {
  const entry = {
    package_id,
    actor,
    jurisdiction_id,
    logged_at: new Date().toISOString(),
  };
  log.push(entry);
  console.log(`[archieveLog] AI call package logged: ${package_id}`);
  return entry;
}

export function getLog() { return log; }
