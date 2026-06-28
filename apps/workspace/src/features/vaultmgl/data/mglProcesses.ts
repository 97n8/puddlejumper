export interface ProcessStageDefinition {
  seq: number
  name: string
  displayLabel: string
  isHardStop: boolean
  mglCitation: string | null
  archieveOnEnter: boolean
}

export interface MglProcessDefinition {
  id: string
  name: string
  category: string
  authority: string
  stageCount: number
  sealAtStage: number
  defaultDueDays: number
  stages: ProcessStageDefinition[]
}

export const MGL_PROCESSES: MglProcessDefinition[] = [
  {
    id: 'proc_prr',
    name: 'Public Records Request',
    category: 'Records',
    authority: 'MGL c.66 §10',
    stageCount: 5,
    sealAtStage: 5,
    defaultDueDays: 10,
    stages: [
      { seq: 1, name: 'Intake', displayLabel: 'Request Received', isHardStop: false, mglCitation: 'MGL c.66 §10(a)', archieveOnEnter: true },
      { seq: 2, name: 'Classification', displayLabel: 'Records Classified', isHardStop: true, mglCitation: 'MGL c.66 §10(b)', archieveOnEnter: true },
      { seq: 3, name: 'Review', displayLabel: 'Under Review', isHardStop: false, mglCitation: null, archieveOnEnter: false },
      { seq: 4, name: 'Redaction', displayLabel: 'Redaction Applied', isHardStop: true, mglCitation: 'MGL c.66 §10(d)', archieveOnEnter: true },
      { seq: 5, name: 'Response', displayLabel: 'Response Issued', isHardStop: false, mglCitation: 'MGL c.66 §10(f)', archieveOnEnter: true },
    ],
  },
  {
    id: 'proc_oml',
    name: 'Open Meeting Notice',
    category: 'Board Compliance',
    authority: 'MGL c.30A §20',
    stageCount: 4,
    sealAtStage: 4,
    defaultDueDays: 2,
    stages: [
      { seq: 1, name: 'Draft', displayLabel: 'Agenda Drafted', isHardStop: false, mglCitation: 'MGL c.30A §20(a)', archieveOnEnter: true },
      { seq: 2, name: 'Review', displayLabel: 'Chair Review', isHardStop: true, mglCitation: 'MGL c.30A §20(b)', archieveOnEnter: true },
      { seq: 3, name: 'Posted', displayLabel: '48-hr Posting', isHardStop: true, mglCitation: 'MGL c.30A §20(c)', archieveOnEnter: true },
      { seq: 4, name: 'Certified', displayLabel: 'Meeting Certified', isHardStop: false, mglCitation: 'MGL c.30A §20(g)', archieveOnEnter: true },
    ],
  },
  {
    id: 'proc_permit',
    name: 'Building Permit',
    category: 'Permitting',
    authority: 'MGL c.40A §6; 780 CMR',
    stageCount: 6,
    sealAtStage: 6,
    defaultDueDays: 30,
    stages: [
      { seq: 1, name: 'Intake', displayLabel: 'Application Received', isHardStop: false, mglCitation: '780 CMR §107', archieveOnEnter: true },
      { seq: 2, name: 'Zoning', displayLabel: 'Zoning Check', isHardStop: true, mglCitation: 'MGL c.40A §6', archieveOnEnter: true },
      { seq: 3, name: 'Plans Review', displayLabel: 'Plans Under Review', isHardStop: false, mglCitation: '780 CMR §107.3', archieveOnEnter: false },
      { seq: 4, name: 'Inspection', displayLabel: 'Site Inspection', isHardStop: false, mglCitation: '780 CMR §109', archieveOnEnter: false },
      { seq: 5, name: 'Approval', displayLabel: 'Inspector Sign-off', isHardStop: true, mglCitation: '780 CMR §111', archieveOnEnter: true },
      { seq: 6, name: 'Issued', displayLabel: 'Permit Issued', isHardStop: false, mglCitation: '780 CMR §105.3', archieveOnEnter: true },
    ],
  },
  {
    id: 'proc_apwarrant',
    name: 'AP Warrant',
    category: 'Finance',
    authority: 'MGL c.41 §52',
    stageCount: 4,
    sealAtStage: 4,
    defaultDueDays: 7,
    stages: [
      { seq: 1, name: 'Draft', displayLabel: 'Warrant Drafted', isHardStop: false, mglCitation: 'MGL c.41 §52', archieveOnEnter: true },
      { seq: 2, name: 'Finance Review', displayLabel: 'Finance Review', isHardStop: true, mglCitation: 'MGL c.41 §52', archieveOnEnter: true },
      { seq: 3, name: 'Selectboard', displayLabel: 'Selectboard Signature', isHardStop: true, mglCitation: 'MGL c.41 §52', archieveOnEnter: true },
      { seq: 4, name: 'Processed', displayLabel: 'Processed & Sealed', isHardStop: false, mglCitation: null, archieveOnEnter: true },
    ],
  },
  {
    id: 'proc_procurement',
    name: 'Procurement / Vendor Intake',
    category: 'Procurement',
    authority: 'MGL c.30B',
    stageCount: 5,
    sealAtStage: 5,
    defaultDueDays: 45,
    stages: [
      { seq: 1, name: 'Request', displayLabel: 'Need Documented', isHardStop: false, mglCitation: 'MGL c.30B §5', archieveOnEnter: true },
      { seq: 2, name: 'Threshold', displayLabel: 'Threshold Determined', isHardStop: true, mglCitation: 'MGL c.30B §1', archieveOnEnter: true },
      { seq: 3, name: 'Solicitation', displayLabel: 'Solicitation Issued', isHardStop: false, mglCitation: 'MGL c.30B §5', archieveOnEnter: false },
      { seq: 4, name: 'Award', displayLabel: 'Contract Awarded', isHardStop: true, mglCitation: 'MGL c.30B §6', archieveOnEnter: true },
      { seq: 5, name: 'Executed', displayLabel: 'Contract Executed', isHardStop: false, mglCitation: null, archieveOnEnter: true },
    ],
  },
]

export function getProcessById(id: string): MglProcessDefinition | undefined {
  return MGL_PROCESSES.find(p => p.id === id)
}
