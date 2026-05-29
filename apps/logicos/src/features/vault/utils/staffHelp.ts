/**
 * staffHelp.ts — Contextual help content for VAULT staff interfaces
 *
 * Every string here is written for a municipal employee who is new to the system.
 * Assume no prior knowledge of the specific module. Explain what's happening,
 * what they need to do, and what happens if they don't.
 */

// ─── Tab help (Case Detail) ────────────────────────────────────────────────────

export const TAB_HELP: Record<string, string> = {
  overview:
    `A read-only summary of the full case — who it's from, what was requested, all deadlines, and the case record metadata. Nothing here changes the case.`,
  stage:
    'The active work area for this case. Fill in the required fields for the current stage, save your work, then advance when all gate checks are complete. The system will prevent advancing if required fields are missing.',
  approvals:
    'Record formal disclosure decisions for this case — Full Disclosure, Partial Disclosure, Denial, or Extension. Each decision is a permanent legal record tied to this case number. For Public Records Requests only.',
  assets:
    'Documents, files, and records attached to this case. Files marked KEEPER are automatically locked (read-only) when the case closes — you cannot unlock them. If you need to correct a locked record, create a new version.',
  builder:
    'Write and save documents related to this case: response letters, internal memos, status reports. Documents are stored on the case record and can be backed up to your connector (SharePoint, Google Drive, or GitHub).',
  audit:
    'A complete, immutable chronological log of every action taken on this case — who did what and when. Entries cannot be edited or deleted. This log is the legal record of case handling.',
}

// ─── Module help ───────────────────────────────────────────────────────────────

export const MODULE_HELP: Record<string, {
  summary: string
  whoUses: string
  keyRule: string
  tip: string
}> = {
  VAULTPRR: {
    summary: 'Tracks public records requests from initial receipt through response and closure.',
    whoUses: 'Records Access Officers (RAOs) and any department head who receives records requests.',
    keyRule: 'Must acknowledge within 10 business days (T10). If T10 is missed, fees are permanently and automatically prohibited for that request — no exceptions.',
    tip: 'The T10 clock starts the moment the case is created. Check the deadline badge immediately after intake.',
  },
  VAULTCLERK: {
    summary: 'Manages license and permit applications processed through the Town Clerk\'s office.',
    whoUses: 'Town Clerk, licensing board members, and department reviewers.',
    keyRule: 'Completeness review must happen within 10 business days (T10). Final decision within 30 business days (T30).',
    tip: 'If the application is incomplete, issue a written deficiency notice before the T10 deadline — the clock pauses while waiting for the applicant to respond.',
  },
  VAULTFISCAL: {
    summary: 'Tracks vendor invoices and accounts payable from receipt through authorized payment.',
    whoUses: 'Town Accountant, Treasurer, and department heads approving expenditures.',
    keyRule: 'Payment is due within 30 days of invoice receipt per M.G.L. c. 41, §52. Late payments may trigger interest penalties.',
    tip: 'Always verify the GL account code and match against a purchase order before approving. Mismatched invoices must be returned to the vendor.',
  },
  VAULTFIX: {
    summary: 'Work orders for facilities maintenance, repairs, and infrastructure issues.',
    whoUses: 'DPW staff, Facilities Manager, and department heads submitting maintenance requests.',
    keyRule: 'Priority classification must happen within 5 business days. Emergency orders require immediate escalation.',
    tip: 'Set the priority level at intake — it determines the response time target. Emergency = same day. High = 2 days. Normal = 5 days. Low = 15 days.',
  },
  VAULTONBOARD: {
    summary: 'Tracks new employee onboarding from offer acceptance through first-day sign-off.',
    whoUses: 'HR Department, department heads, and IT.',
    keyRule: 'Background check (CORI) must be cleared before IT setup can begin. Do not advance past Background without clearance on file.',
    tip: 'Create the case the day the offer is accepted — not the day the employee starts. VAULT tracks pre-start tasks.',
  },
  VAULTTIME: {
    summary: 'Manages employee time submissions, overtime approvals, and payroll posting.',
    whoUses: 'Employees, direct supervisors, Payroll, and Finance Director.',
    keyRule: 'Supervisor must review within 5 business days. Overtime requires a separate approval step before payroll posting.',
    tip: 'If an employee submits overtime without prior approval, flag it at the Supervisor Review stage before advancing.',
  },
  VAULTPERMIT: {
    summary: 'Tracks building and use permit applications from submission through issuance and inspections.',
    whoUses: 'Building Inspector, Zoning Board, Planning Department, and Conservation Commission.',
    keyRule: 'Completeness review within 10 days. Decision within 30 business days (65 days for special permits under M.G.L. c. 40A).',
    tip: 'All board conditions (ZBA, ConCom, Planning) must be documented in the Conditions stage before the permit is issued.',
  },
  VAULTHR: {
    summary: 'Manages formal HR actions: hiring, terminations, leave requests, and disciplinary actions.',
    whoUses: 'HR Director, Department Heads, Town Manager, and Town Counsel for significant actions.',
    keyRule: 'HR must complete initial review within 15 business days (T15). Most actions require both department head and Town Manager approval.',
    tip: 'Do not execute an HR action (send offer letter, issue separation documents) before all required approvals are documented in VAULT.',
  },
  VAULTPROCURE: {
    summary: 'Tracks procurement and contracting from specification through execution and monitoring.',
    whoUses: 'Procurement Officer, Finance Director, Town Manager, and department heads.',
    keyRule: 'Competitive bidding is required for most purchases over $10,000 under M.G.L. c. 30B. Document every step of the evaluation process.',
    tip: 'The solicitation must be publicly advertised for the required time before bids close. Document the advertisement date and method.',
  },
  VAULTRECS: {
    summary: 'Manages classification, scheduling, and disposition of town records per the state schedule.',
    whoUses: 'Records Officer, department heads, and Town Clerk.',
    keyRule: 'Records must follow the state-approved retention schedule. You cannot dispose of records without authorization — even records that seem obviously outdated.',
    tip: 'Before executing disposition, check for legal holds, active audits, or pending litigation that could require the records to be preserved.',
  },
  VAULTMEET: {
    summary: 'Tracks meeting notices, agendas, and minutes for boards and committees under Open Meeting Law.',
    whoUses: 'Board/Committee Clerk, Meeting Chair, and Town Clerk.',
    keyRule: 'Notice must be posted at least 48 hours in advance. Approved minutes must be posted to the town website within 30 days of approval.',
    tip: 'Keep draft minutes separate from approved minutes — only approved minutes are the official record. Record all votes, including abstentions.',
  },
}

// ─── Stage help (per module, per stage) ───────────────────────────────────────

export const STAGE_HELP: Record<string, Record<string, { what: string; doThis: string }>> = {
  VAULTPRR: {
    INTAKE: {
      what: 'A new public records request has been received. VAULT will automatically compute the T10 and T25 deadlines from this moment.',
      doThis: 'Record the requester\'s name and contact information, and transcribe the request text exactly as received. Do not interpret or paraphrase.',
    },
    ASSESSMENT: {
      what: 'Review the request for responsiveness. Determine whether the records exist, are accessible, and estimate how long gathering will take.',
      doThis: 'Complete the responsiveness determination. Define the scope clearly. If the request is unclear, contact the requester — but this does not pause the T10 clock.',
    },
    GATHERING: {
      what: 'Actively search all likely locations for responsive records.',
      doThis: 'Document every location searched, even if no records were found there. A thorough search log protects the town if the response is later challenged.',
    },
    REVIEW: {
      what: 'Apply any applicable exemptions under M.G.L. c. 4, §7(26). Check fee eligibility.',
      doThis: 'Document each exemption applied and the specific records it covers. If T10 was missed, fees are prohibited — the system enforces this automatically.',
    },
    RESPONSE: {
      what: 'Deliver the responsive records or issue a withholding/denial letter.',
      doThis: 'Record the delivery method and date. If withholding any records, a letter citing the specific exemptions is required.',
    },
    CLOSED: {
      what: 'The request is fully resolved. The T90 appeal window is now running.',
      doThis: 'No action needed. The requester has 90 calendar days to appeal to the Supervisor of Records if they are unsatisfied.',
    },
  },
  VAULTCLERK: {
    INTAKE: {
      what: 'A new license or permit application has been received.',
      doThis: 'Record all applicant information and the type of license/permit requested. Stamp the date received — the T10 completeness clock starts now.',
    },
    COMPLETENESS: {
      what: 'Review the application to confirm it is complete and all required documents are attached.',
      doThis: 'If anything is missing, issue a written deficiency notice to the applicant and document it here. Incomplete applications cannot advance.',
    },
    INSPECTION: {
      what: 'Any required site inspection or background check happens here.',
      doThis: 'Record the inspector\'s name, the inspection date, and the result. If no inspection is required, note that explicitly.',
    },
    DECISION: {
      what: 'The licensing board or clerk makes the approval or denial decision.',
      doThis: 'Record who made the decision, the date, and any conditions attached. Denials require a written reason.',
    },
    ISSUANCE: {
      what: 'The license or permit is formally issued to the applicant.',
      doThis: 'Assign a license number, record the issue date and expiration date, and document how the license was delivered.',
    },
    CLOSED: {
      what: 'License or permit issued (or denial finalized).',
      doThis: 'No further action. File the original application in records management.',
    },
  },
  VAULTFISCAL: {
    INTAKE: {
      what: 'An invoice has been received from a vendor.',
      doThis: 'Record vendor name, invoice number, invoice date, amount, and the GL account code. Verify the invoice is addressed to the town.',
    },
    MATCH: {
      what: 'Match the invoice against the purchase order and goods/services receipt.',
      doThis: 'Confirm that the items and amounts on the invoice match what was ordered and received. Flag any discrepancies before advancing.',
    },
    BUDGET: {
      what: 'Finance confirms that sufficient budget is available in the specified GL account.',
      doThis: 'Check the current account balance. If funds are insufficient, do not advance — contact the department head about a budget transfer.',
    },
    APPROVAL: {
      what: 'The department head approves the payment.',
      doThis: 'Route to the authorizing department head. Record their name and approval date. Do not advance without documented approval.',
    },
    PAYMENT: {
      what: 'The Treasurer issues payment by check or ACH.',
      doThis: 'Record the payment method, date, and check/transaction number.',
    },
    CLOSED: {
      what: 'Invoice paid and filed.',
      doThis: 'File the original invoice and supporting documentation per the records retention schedule.',
    },
  },
  VAULTFIX: {
    INTAKE: {
      what: 'A maintenance work order has been submitted.',
      doThis: 'Record the location, issue description, and who submitted the request. Take photos if available.',
    },
    PRIORITY: {
      what: 'Assess the urgency and assign a priority level.',
      doThis: 'Emergency = same-day response. High = 2 business days. Normal = 5 business days. Low = 15 business days. Document your reasoning.',
    },
    ASSIGNED: {
      what: 'The work order is assigned to a crew member or contractor.',
      doThis: 'Record who is assigned and the expected start date. Notify the person assigned.',
    },
    IN_PROGRESS: {
      what: 'Work is actively underway.',
      doThis: 'Log progress notes and any complications discovered. Update the expected completion date if needed.',
    },
    VERIFICATION: {
      what: 'A supervisor inspects the completed work.',
      doThis: 'Confirm the original issue is resolved. Note any follow-up work required. Do not close until verified.',
    },
    CLOSED: {
      what: 'Work is complete and verified.',
      doThis: 'Record the final resolution. Notify the person who submitted the request.',
    },
  },
  VAULTONBOARD: {
    INTAKE: {
      what: 'A new hire offer has been accepted.',
      doThis: 'Record the new hire\'s name, position, department, and start date. Create the case as soon as the offer is accepted — not on the start date.',
    },
    BACKGROUND: {
      what: 'CORI and any other background checks are initiated and pending.',
      doThis: 'Do not advance to Setup until the background check is cleared. A hold here protects the town from liability.',
    },
    SETUP: {
      what: 'IT and equipment setup for the new employee.',
      doThis: 'Create accounts, issue credentials, configure equipment, and set up workspace. Document each item completed.',
    },
    TRAINING: {
      what: 'Required training is completed before or during the first week.',
      doThis: 'Required courses typically include: Sexual Harassment Prevention, Ethics, CORI awareness, and any department-specific training. Record completion for each.',
    },
    SIGNOFF: {
      what: 'HR and the Department Head confirm onboarding is complete.',
      doThis: 'Both HR and the department head must sign off. New hire should confirm receipt of all required materials.',
    },
    CLOSED: {
      what: 'Onboarding complete. Employee is active.',
      doThis: 'File all onboarding documents per the personnel records retention schedule.',
    },
  },
  VAULTTIME: {
    INTAKE: {
      what: 'Time submission received from an employee.',
      doThis: 'Record the employee name, pay period, and total hours submitted. Flag if overtime is included.',
    },
    SUPERVISOR_REVIEW: {
      what: 'The employee\'s direct supervisor reviews and approves the hours.',
      doThis: 'Supervisor confirms hours are accurate and work was authorized. Record supervisor name and approval date.',
    },
    OVERTIME_REVIEW: {
      what: 'Overtime hours require separate approval from Finance or HR.',
      doThis: 'If no overtime is present, you can advance past this stage. If overtime exists, it must be separately approved before payroll.',
    },
    PAYROLL: {
      what: 'Approved hours are submitted to payroll for processing.',
      doThis: 'Submit to payroll system and record the submission date and who processed it.',
    },
    POSTED: {
      what: 'Hours have been posted and confirmed in the payroll system.',
      doThis: 'Verify hours posted correctly. Notify the employee if there were any adjustments.',
    },
  },
  VAULTPERMIT: {
    INTAKE: {
      what: 'A new building or use permit application has been received.',
      doThis: 'Record all property information, project description, and applicant contact. The clock starts now.',
    },
    VERIFICATION: {
      what: 'Confirm the application is complete and the project is consistent with zoning.',
      doThis: 'Check zoning district, use, setbacks, lot coverage. Route to ZBA or Planning if a special permit or variance is needed.',
    },
    CONDITIONS: {
      what: 'Any conditions from reviewing boards are applied to the permit.',
      doThis: 'Record all conditions from ZBA, Conservation Commission, Planning Board, or Board of Health. These must be on the face of the permit.',
    },
    FEES: {
      what: 'Permit fees are calculated and collected.',
      doThis: 'Calculate fees per the current fee schedule. Record amount paid, method, and receipt number.',
    },
    ISSUANCE: {
      what: 'The permit is formally issued.',
      doThis: 'Assign a permit number, record the issue date, and post required notices. Issue the permit to the applicant.',
    },
    COMPLIANCE: {
      what: 'Inspections during construction confirm compliance with the permit.',
      doThis: 'Record each inspection visit, inspector name, and result. A final inspection is required before closure.',
    },
    CLOSED: {
      what: 'Project complete and final inspection passed.',
      doThis: 'Confirm all inspections are documented. File the permit record per retention schedule.',
    },
  },
  VAULTHR: {
    INTAKE: {
      what: 'An HR action has been initiated.',
      doThis: 'Record the type of action (hire, termination, leave, discipline), the affected employee, and who initiated the request.',
    },
    HR_REVIEW: {
      what: 'HR reviews the action for legal compliance, policy compliance, and completeness.',
      doThis: 'HR must complete review within 15 business days (T15). Check collective bargaining agreements if applicable.',
    },
    DEPT_HEAD: {
      what: 'The department head approves or rejects the action.',
      doThis: 'Route to department head for decision. Record name, date, and any conditions.',
    },
    TOWN_MANAGER: {
      what: 'The Town Manager provides final approval.',
      doThis: 'Required for most significant HR actions. Record Town Manager approval date. Do not execute the action without this.',
    },
    EXECUTION: {
      what: 'The HR action is formally executed.',
      doThis: 'Send offer letter, issue separation notice, approve leave, or implement discipline — per what was approved. Document execution date.',
    },
    CLOSED: {
      what: 'HR action complete and documented.',
      doThis: 'File all documents in the employee personnel file per M.G.L. c. 66, §10 and personnel records retention schedule.',
    },
  },
  VAULTPROCURE: {
    SPEC: {
      what: 'Define what the town wants to buy and how it will be procured.',
      doThis: 'Write specifications, determine the procurement method (IFB, RFP, sole source), and get Finance to confirm budget availability.',
    },
    SOLICITATION: {
      what: 'Issue the solicitation to the market.',
      doThis: 'Post to the required platforms, publish in the Central Register (required by M.G.L. c. 30B for most procurements), and document the advertisement date.',
    },
    BID_EVAL: {
      what: 'Evaluate the bids or proposals received.',
      doThis: 'Use a documented scoring process. Record all evaluators and scores. Keep all bids on file — even losing bids must be retained.',
    },
    AWARD: {
      what: 'Select the winning vendor and make the award determination.',
      doThis: 'Document the rationale for selection. Notify all bidders of the award decision. Provide required de-brief to unsuccessful bidders if requested.',
    },
    CONTRACT: {
      what: 'Execute the contract with the selected vendor.',
      doThis: 'Ensure the contract includes all M.G.L. c. 30B required provisions (prevailing wage, insurance, etc.). Record execution date and contract number.',
    },
    MONITORING: {
      what: 'Monitor contract performance through completion.',
      doThis: 'Document any issues, amendments, or disputes. Amendments must follow the same procurement rules as the original if they materially change scope.',
    },
    CLOSED: {
      what: 'Contract is complete or has been terminated.',
      doThis: 'Record final acceptance, any outstanding disputes, and retention period for contract documents.',
    },
  },
  VAULTRECS: {
    CLASSIFICATION: {
      what: 'Identify the record type and apply the correct records category.',
      doThis: 'Refer to the Massachusetts Records Retention Schedule (950 CMR 32). Match the record to the correct schedule entry.',
    },
    SCHEDULE: {
      what: 'Apply the retention schedule and determine the disposition instructions.',
      doThis: 'Record the retention period, triggering event (creation, closure, etc.), and authorized disposition (destroy, archive, permanent).',
    },
    ACTIVE: {
      what: 'The record is in active use and being maintained.',
      doThis: 'No action required. The record remains here until the retention period is met.',
    },
    REVIEW: {
      what: 'Review for disposition eligibility — confirm the retention period has been met and no holds apply.',
      doThis: 'Check for legal holds, active litigation, pending audits, or open records requests that require the records to be preserved regardless of schedule.',
    },
    DISPOSITION: {
      what: 'Execute the authorized disposition.',
      doThis: 'For destruction: document the method and who authorized it. For transfer to Archives: get State Archives receipt. For permanent retention: seal and store.',
    },
    CLOSED: {
      what: 'Disposition is complete and documented.',
      doThis: 'Retain the disposition certificate per the records retention schedule. This is itself a permanent record.',
    },
  },
  VAULTMEET: {
    NOTICE: {
      what: 'The meeting notice must be posted at least 48 hours before the meeting.',
      doThis: 'Post to all required locations (town website, Town Clerk\'s office, building entrance). Record the date and time of posting — a late posting can invalidate the meeting.',
    },
    AGENDA: {
      what: 'The agenda is finalized and posted.',
      doThis: 'Items may only be added after posting with a 48-hour notice. Emergency additions require a majority vote. Record agenda version.',
    },
    IN_MEETING: {
      what: 'The meeting is in progress.',
      doThis: 'Take detailed minutes. Record all votes (including abstentions and member names). Note any executive session and the reason cited under Open Meeting Law.',
    },
    DRAFT_MINUTES: {
      what: 'Draft minutes have been prepared.',
      doThis: 'Distribute draft minutes to board/committee members for review. Do not post draft minutes publicly — only approved minutes are the official record.',
    },
    APPROVED: {
      what: 'Minutes have been approved by the board/committee at a subsequent meeting.',
      doThis: 'Record the date and meeting at which minutes were approved. Corrections to draft minutes must be noted.',
    },
    POSTED: {
      what: 'Approved minutes are posted to the town website.',
      doThis: 'Must be posted within 30 days of approval. Record the posting date. Minutes must remain publicly accessible.',
    },
    CLOSED: {
      what: 'Meeting record is complete.',
      doThis: 'File all materials per the records retention schedule for meeting minutes.',
    },
  },
}

// ─── Deadline help ────────────────────────────────────────────────────────────

export const DEADLINE_HELP: Record<string, { label: string; what: string; consequence: string }> = {
  T10: {
    label: 'T10 — 10 Business Days',
    what: '10 business days from case creation. This is the statutory response/acknowledgment deadline.',
    consequence: 'For Public Records Requests: if T10 is missed, fees are permanently prohibited for that request. The system enforces this automatically and it cannot be reversed.',
  },
  T15: {
    label: 'T15 — 15 Business Days',
    what: '15 business days from case creation. Initial departmental review must be complete.',
    consequence: 'Missing T15 creates compliance exposure. Escalate immediately if at risk.',
  },
  T25: {
    label: 'T25 — 25 Business Days',
    what: 'For Public Records Requests: full production of records must be complete by this date.',
    consequence: 'If you need more time beyond T25, you must obtain the requester\'s written agreement OR file a petition with the Supervisor of Records. You cannot simply miss this deadline.',
  },
  T30: {
    label: 'T30 — 30 Calendar Days',
    what: '30 calendar days from case creation or invoice receipt. Decision or payment deadline.',
    consequence: 'Late payments trigger interest under M.G.L. c. 41, §52. Late licensing decisions may create default approvals in some contexts.',
  },
  T90: {
    label: 'T90 — 90 Calendar Days (Appeal Window)',
    what: '90 calendar days from case closure. This is the window during which the requester can appeal to the Supervisor of Records.',
    consequence: 'No staff action required. The case is closed. Keep all records intact during this period in case an appeal is filed.',
  },
  TNOTICE: {
    label: 'Notice Deadline — 48 Hours',
    what: 'Meeting notice must be posted at least 48 hours before the scheduled start time (excluding weekends and holidays).',
    consequence: 'A late notice can invalidate the meeting and all votes taken at it. This is a core Open Meeting Law requirement.',
  },
}

// ─── Audit action labels (for display in audit log) ───────────────────────────

export const AUDIT_ACTION_HELP: Record<string, string> = {
  CREATE: 'Case created and initial deadlines computed.',
  UPDATE: 'Stage data or case information was saved.',
  STAGE_TRANSITION: 'Case advanced to the next workflow stage.',
  ASSET_ADD: 'A file or document was attached to this case.',
  ASSET_LOCK: 'An asset was locked — it can no longer be edited.',
  DEADLINE_MET: 'A deadline was marked as completed on time.',
  DEADLINE_MISSED: 'A deadline was missed — see consequences above.',
  ENFORCEMENT: 'An automatic enforcement action was taken (e.g. fee prohibition). This was triggered by the system, not a staff member.',
  ESCALATION: 'Case was escalated to a supervisor or external authority.',
  ASSIGN_RAO: 'A Records Access Officer was assigned to this case.',
  TROLL_START: 'Statute clock override started (non-standard handling).',
  TROLL_END: 'Statute clock override ended.',
  CLOSE: 'Case was formally closed.',
  BACKUP: 'Case record was backed up to the configured connector.',
  EMAIL_SENT: 'A notification email was sent.',
  APPROVAL: 'A formal disclosure decision was recorded.',
}

// ─── General UI help ──────────────────────────────────────────────────────────

export const UI_HELP = {
  caseNumber:
    'A unique identifier for this case, automatically generated from the module code, year, and sequence number. Use this number in all correspondence.',
  assignedRAO:
    'The Records Access Officer responsible for this case. Set in module Settings. The RAO is the legally designated point of contact for public records requests.',
  scopeDefinition:
    'A precise description of exactly what records are being produced (or what action is being taken). Each change to scope is versioned and timestamped.',
  feesProhibited:
    'Fees have been automatically prohibited because the T10 deadline was missed. This is required by M.G.L. c. 66, §10 and cannot be overridden. The system applied this enforcement automatically.',
  gateChecks:
    'Required steps that must be completed before this case can advance to the next stage. Completing gate checks doesn\'t advance the case — it confirms you\'ve done the required work at this stage.',
  closeCase:
    'Closing a case is a formal action. KEEPER-class assets will be locked automatically. A Boss HTML case summary will be generated and backed up to your connector. This action is recorded in the audit log.',
  backup:
    'Saves a copy of the case record to your configured connector (SharePoint, Google Drive, or GitHub). Backups run automatically on case closure, but you can also trigger one manually here.',
  publicForm:
    'Opens the public-facing intake form for this module. Share this link with members of the public to let them submit requests directly into VAULT.',
  civicPulse:
    'Publishes a redacted, public-facing summary of this case to CivicPulse, the public transparency dashboard. Only non-sensitive information is shown.',
}
