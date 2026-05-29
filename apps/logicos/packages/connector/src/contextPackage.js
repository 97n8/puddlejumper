/**
 * Assembles a PuddleJumperContextPackage for AI calls.
 * package_id is logged to SEAL before every use (via archieveLog).
 */
export function buildContextPackage({ jurisdiction, caseRow, rules, actor }) {
  return {
    package_id:      crypto.randomUUID(),
    jurisdiction_id: jurisdiction?.id,
    jurisdiction:    { name: jurisdiction?.name, slug: jurisdiction?.slug },
    case:            caseRow ? { id: caseRow.id, case_type: caseRow.case_type, stage: caseRow.stage } : null,
    rules:           (rules || []).map(r => ({
      id:             r.id,
      rule_key:       r.rule_key,
      description:    r.description,
      source_citation: r.source_citation,
      conditions:     JSON.parse(r.conditions  || '[]'),
      actions:        JSON.parse(r.actions     || '[]'),
      common_catches: JSON.parse(r.common_catches || '[]'),
    })),
    actor: actor ? { id: actor.actor_id, role: actor.role } : null,
    assembled_at: new Date().toISOString(),
  };
}
