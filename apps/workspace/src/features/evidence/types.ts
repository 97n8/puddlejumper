export interface AuditEvent {
  id: string
  eventType: string
  actorId: string
  actorName: string
  targetType: string
  targetId: string
  payload: Record<string, unknown>
  sealHash?: string
  occurredAt: string
}

export interface EvidencePackage {
  id: string
  title: string
  description: string
  eventIds: string[]
  packageHash: string
  generatedAt: string
  generatedBy: string
  format: 'json' | 'pdf_stub'
}
