export interface VaultBuildTemplate {
  id: string
  moduleId: string
  code: string
  name: string
  department: string
  workspace: string
  statutoryAuthority: string
  retentionCode: string
  retentionDescription: string
  statutoryDeadline: string
  summary: string
  stages: string[]
  keyFields: string[]
  acceptanceCriteria: string[]
  stopRules: string[]
  trainingFocus: string
  archieveFolder: string
  archieveNaming: string
  deploymentPrerequisites: string[]
}

export const VAULT_BUILD_TEMPLATES: VaultBuildTemplate[] = [
  {
    "id": "ap",
    "moduleId": "VAULT-AP",
    "code": "AP",
    "name": "Accounts Payable / Warrant",
    "department": "Finance",
    "workspace": "AP / Warrants",
    "statutoryAuthority": "MGL Ch. 41 \u00a7\u00a752\u201356",
    "retentionCode": "10.7",
    "retentionDescription": "7 years from fiscal year end",
    "statutoryDeadline": "Weekly or bi-weekly warrant cycle",
    "summary": "Manages the warrant process from invoice receipt through Select Board approval and payment. Ensures proper authorization chain: department approval \u2192 accountant review \u2192 warrant assembly \u2192 Board vote \u2192 treasurer payment.",
    "stages": [
      "Invoice Received",
      "Department Approval",
      "Accountant Review",
      "Warrant Assembly",
      "Select Board Approval",
      "Payment",
      "Archive & Close"
    ],
    "keyFields": [
      "vendor_name",
      "invoice_number",
      "amount",
      "department",
      "budget_line",
      "approval_authority"
    ],
    "acceptanceCriteria": [
      "Invoice documented",
      "Dept head approved",
      "Accountant verified budget",
      "Board approved warrant",
      "Payment issued",
      "Sealed"
    ],
    "stopRules": [
      "Budget insufficient",
      "Missing departmental approval",
      "Duplicate invoice",
      "Vendor W-9 not on file"
    ],
    "trainingFocus": "The warrant is the legal authorization for municipal spending. No payment issues without a signed warrant. The Town Accountant is the gatekeeper \u2014 they verify budget availability and proper authorization. The Select Board votes on every warrant.",
    "archieveFolder": "{TOWN}/Finance/{YEAR}/Warrants/",
    "archieveNaming": "FIN_WARRANT_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "biz",
    "moduleId": "VAULT-BIZ",
    "code": "BIZ",
    "name": "Business Certificate (DBA)",
    "department": "Clerk / Records",
    "workspace": "Licensing",
    "statutoryAuthority": "MGL Ch. 110 \u00a75",
    "retentionCode": "10.8",
    "retentionDescription": "4 years from filing or expiration",
    "statutoryDeadline": "Clerk records within 10 days of filing",
    "summary": "Tracks business certificate (DBA) filings from application through recording and expiration. Handles name conflict checks, certificate generation, and the 4-year renewal cycle.",
    "stages": [
      "Filing Received",
      "Clerk Review",
      "Recording",
      "Archive & Close"
    ],
    "keyFields": [
      "business_name",
      "owner_name",
      "business_address",
      "business_type",
      "expiration_date"
    ],
    "acceptanceCriteria": [
      "Name conflict check complete",
      "Filing recorded",
      "Certificate generated",
      "Sealed"
    ],
    "stopRules": [
      "Name conflict unresolved",
      "Filing fee not collected"
    ],
    "trainingFocus": "Name conflict check is critical \u2014 search existing DBAs before recording. The system flags potential conflicts. 4-year expiration is tracked automatically; renewal notices go out 60 days before expiration.",
    "archieveFolder": "{TOWN}/TownClerk/{YEAR}/BusinessCerts/",
    "archieveNaming": "CLERK_BIZ_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "bld",
    "moduleId": "VAULT-BLD",
    "code": "BLD",
    "name": "Building Permit",
    "department": "Building / Land Use",
    "workspace": "Permitting",
    "statutoryAuthority": "MGL Ch. 143 \u00a73L; 780 CMR",
    "retentionCode": "10.4",
    "retentionDescription": "10 years from project completion",
    "statutoryDeadline": "30 calendar days from complete application",
    "summary": "Full building permit lifecycle from application through Certificate of Occupancy. Tier-based approval routing by project cost. Zoning referral integration. Multi-phase inspection tracking.",
    "stages": [
      "Application Received",
      "Completeness Review",
      "Zoning Check",
      "Plan Review",
      "Approval Routing",
      "Permit Issuance",
      "Inspections",
      "Certificate of Occupancy",
      "Archive & Close"
    ],
    "keyFields": [
      "applicant_name",
      "property_address",
      "parcel_id",
      "project_type",
      "estimated_cost",
      "contractor_license",
      "plans_uploaded"
    ],
    "acceptanceCriteria": [
      "Application complete",
      "Zoning confirmed",
      "Plans approved",
      "Approval tier satisfied",
      "Permit issued",
      "All inspections passed",
      "CO issued",
      "Sealed"
    ],
    "stopRules": [
      "Inspection failed/pending",
      "Plans have unresolved comments",
      "Zoning referral active",
      "Contractor license invalid",
      "Appeal active",
      "Permit expired"
    ],
    "trainingFocus": "The 30-day clock starts only when the application is COMPLETE \u2014 not when it's received. Completeness review is critical. Cost-based approval tiers route automatically. Inspections are sub-stages \u2014 each requires explicit sign-off.",
    "archieveFolder": "{TOWN}/BuildingDept/{YEAR}/Permits/{CASE}/",
    "archieveNaming": "BLDG_PERMIT_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "boh",
    "moduleId": "VAULT-BOH",
    "code": "BOH",
    "name": "Board of Health",
    "department": "Health & Human Services",
    "workspace": "Board of Health",
    "statutoryAuthority": "MGL Ch. 111; 310 CMR; Title 5",
    "retentionCode": "10.5",
    "retentionDescription": "PERMANENT for Title 5; 7 years for permits",
    "statutoryDeadline": "Per permit type and inspection schedule",
    "summary": "Covers the full range of Board of Health functions \u2014 Title 5 septic system reviews, food service permits, pool permits, camp permits, and health complaints. Inspection tracking and compliance monitoring built in.",
    "stages": [
      "Application/Complaint Received",
      "Review & Inspection",
      "Board Review (if required)",
      "Decision / Permit",
      "Compliance Monitoring",
      "Archive & Close"
    ],
    "keyFields": [
      "application_type",
      "property_address",
      "applicant_name",
      "inspection_required"
    ],
    "acceptanceCriteria": [
      "Inspection complete",
      "Board decision documented",
      "Permit issued or action taken",
      "Compliance confirmed",
      "Sealed"
    ],
    "stopRules": [
      "Failed inspection unresolved",
      "Public health risk documented",
      "Board order not complied with",
      "Required follow-up pending"
    ],
    "trainingFocus": "Title 5 records are PERMANENT \u2014 they travel with the property forever. Food service inspections follow 105 CMR 590.000. The system generates the inspection schedule automatically. Failed inspections create mandatory follow-up cases.",
    "archieveFolder": "{TOWN}/BOH/{YEAR}/{TYPE}/",
    "archieveNaming": "BOH_{TYPE}_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "coa",
    "moduleId": "VAULT-COA",
    "code": "COA",
    "name": "Council on Aging",
    "department": "Health & Human Services",
    "workspace": "Senior Services",
    "statutoryAuthority": "MGL Ch. 40 \u00a78B",
    "retentionCode": "10.8",
    "retentionDescription": "3 years from program year end",
    "statutoryDeadline": "Program-based",
    "summary": "Manages Council on Aging program enrollment, service delivery, and reporting. Tracks participation for grant reporting and Formula Grant compliance.",
    "stages": [
      "Enrollment / Intake",
      "Service Delivery",
      "Program Completion",
      "Archive & Close"
    ],
    "keyFields": [
      "program_name",
      "participant_name",
      "service_type",
      "emergency_contact"
    ],
    "acceptanceCriteria": [
      "Enrollment complete",
      "Services documented",
      "Program year completed",
      "Sealed"
    ],
    "stopRules": [
      "Emergency contact missing",
      "Medical concern documented without follow-up"
    ],
    "trainingFocus": "Participant privacy is paramount. Emergency contacts must be current. The system tracks participation numbers for the Formula Grant \u2014 accurate data means more state funding. Transportation logs are a common audit target.",
    "archieveFolder": "{TOWN}/COA/{YEAR}/Programs/",
    "archieveNaming": "COA_{PROG}_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "con",
    "moduleId": "VAULT-CON",
    "code": "CON",
    "name": "Conservation / Wetlands",
    "department": "Building / Land Use",
    "workspace": "Conservation",
    "statutoryAuthority": "MGL Ch. 131 \u00a740; Wetlands Protection Act",
    "retentionCode": "10.5",
    "retentionDescription": "PERMANENT \u2014 environmental records",
    "statutoryDeadline": "21 days from close of hearing for Orders of Conditions",
    "summary": "Manages all Conservation Commission filings \u2014 Notices of Intent, Requests for Determination, ANRAD filings, and enforcement orders. Tracks DEP coordination, site visits, Orders of Conditions, compliance monitoring, and Certificates of Compliance.",
    "stages": [
      "Filing Received",
      "Site Visit",
      "Public Hearing",
      "Order of Conditions",
      "Compliance Monitoring",
      "Certificate of Compliance",
      "Archive & Close"
    ],
    "keyFields": [
      "applicant_name",
      "property_address",
      "filing_type",
      "resource_areas",
      "dek_number",
      "hearing_date"
    ],
    "acceptanceCriteria": [
      "DEP notified",
      "Site visit completed",
      "Hearing conducted",
      "OOC issued with conditions",
      "Compliance confirmed",
      "COC issued",
      "Sealed permanent"
    ],
    "stopRules": [
      "DEP appeal active",
      "Conditions not met",
      "Enforcement action pending",
      "Compliance inspection failed"
    ],
    "trainingFocus": "Every filing must be transmitted to DEP. The DEP file number links the local case to the state record. Orders of Conditions include specific requirements \u2014 the system tracks each condition as a sub-item that must be individually signed off during compliance monitoring.",
    "archieveFolder": "{TOWN}/Conservation/{YEAR}/{CASE}/",
    "archieveNaming": "CON_{TYPE}_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "csr",
    "moduleId": "VAULT-CSR",
    "code": "CSR",
    "name": "Constituent Service Request",
    "department": "Administration",
    "workspace": "Constituent Services",
    "statutoryAuthority": "Town policy; best practice",
    "retentionCode": "10.9",
    "retentionDescription": "3 years from resolution",
    "statutoryDeadline": "Priority-based SLA",
    "summary": "Tracks constituent requests from intake through resolution and notification. Integrates with DPW, Building, and other department workflows when a service request requires departmental action.",
    "stages": [
      "Request Received",
      "Triage & Assignment",
      "Response",
      "Constituent Notification",
      "Archive & Close"
    ],
    "keyFields": [
      "requestor_name",
      "requestor_contact",
      "category",
      "description",
      "priority"
    ],
    "acceptanceCriteria": [
      "Request addressed",
      "Resolution documented",
      "Constituent notified",
      "Sealed"
    ],
    "stopRules": [
      "Constituent not notified",
      "Department referral pending",
      "Safety concern unresolved"
    ],
    "trainingFocus": "Every request gets a response. The system routes to the right department automatically. SLA varies by priority: High = 2 business days, Medium = 5, Low = 10. The constituent receives a notification when their request is resolved.",
    "archieveFolder": "{TOWN}/Admin/{YEAR}/ServiceRequests/",
    "archieveNaming": "CSR_{TYPE}_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "dog",
    "moduleId": "VAULT-DOG",
    "code": "DOG",
    "name": "Dog Licensing",
    "department": "Clerk / Records",
    "workspace": "Licensing",
    "statutoryAuthority": "MGL Ch. 140 \u00a7\u00a7137\u2013174E",
    "retentionCode": "10.8",
    "retentionDescription": "3 years from license expiration",
    "statutoryDeadline": "Annual cycle \u2014 renewal by March 31",
    "summary": "Manages the annual dog licensing cycle including rabies verification, fee processing, tag assignment, and late-fee enforcement. Connects to the town's animal control workflow for delinquent licenses.",
    "stages": [
      "Application Received",
      "Rabies Verification",
      "Fee Processing",
      "License Issuance",
      "Archive & Close"
    ],
    "keyFields": [
      "owner_name",
      "dog_name",
      "dog_breed",
      "spayed_neutered",
      "rabies_expiry",
      "tag_number"
    ],
    "acceptanceCriteria": [
      "Rabies current",
      "Fee paid",
      "Tag assigned",
      "License generated",
      "Sealed"
    ],
    "stopRules": [
      "Rabies certification expired",
      "Fee not collected",
      "Prior license violations unresolved"
    ],
    "trainingFocus": "Simple workflow but high volume. The key discipline is rabies verification \u2014 no license issues without current rabies. Late fees kick in automatically after March 31. The system generates the annual delinquent list for animal control.",
    "archieveFolder": "{TOWN}/TownClerk/{YEAR}/DogLicenses/",
    "archieveNaming": "CLERK_DOG_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "dpw",
    "moduleId": "VAULT-DPW",
    "code": "DPW",
    "name": "Work Order / Maintenance",
    "department": "Public Works",
    "workspace": "DPW Operations",
    "statutoryAuthority": "Town bylaw; MGL Ch. 41 \u00a7\u00a768\u201369",
    "retentionCode": "10.9",
    "retentionDescription": "5 years from completion",
    "statutoryDeadline": "Priority-based SLA",
    "summary": "Tracks DPW work orders from request through completion. Priority-based routing ensures emergency issues get immediate attention. Crew assignment, materials tracking, and completion sign-off.",
    "stages": [
      "Request Received",
      "Assessment",
      "Scheduling",
      "Work Performed",
      "Inspection / Sign-off",
      "Archive & Close"
    ],
    "keyFields": [
      "request_type",
      "location",
      "description",
      "priority",
      "assigned_crew"
    ],
    "acceptanceCriteria": [
      "Work completed",
      "Inspection passed",
      "Documentation with photos",
      "Sealed"
    ],
    "stopRules": [
      "Safety concern unresolved",
      "Materials not available",
      "Inspection failed"
    ],
    "trainingFocus": "Priority determines SLA: Emergency = same day, High = 48 hours, Medium = 1 week, Low = 2 weeks. Crews document every job with photos inside the CaseSpace. If a citizen reported it, they get a notification when it's resolved.",
    "archieveFolder": "{TOWN}/DPW/{YEAR}/WorkOrders/",
    "archieveNaming": "DPW_WO_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "elec",
    "moduleId": "VAULT-ELEC",
    "code": "ELEC",
    "name": "Election Administration",
    "department": "Clerk / Records",
    "workspace": "Elections",
    "statutoryAuthority": "MGL Ch. 50\u201356",
    "retentionCode": "10.3",
    "retentionDescription": "Ballots 22 months; records PERMANENT",
    "statutoryDeadline": "Per state election calendar",
    "summary": "Governs every phase of election administration from scheduling through canvass and certification. Chain of custody, ballot retention, and recount procedures are built into the CaseSpace.",
    "stages": [
      "Election Scheduled",
      "Ballot Preparation",
      "Polling Setup",
      "Election Day",
      "Canvass & Certification",
      "Archive & Close"
    ],
    "keyFields": [
      "election_type",
      "election_date",
      "polling_locations",
      "warden",
      "voter_count"
    ],
    "acceptanceCriteria": [
      "All precincts reported",
      "Results canvassed",
      "Certification complete",
      "Recount period expired",
      "Ballots secured"
    ],
    "stopRules": [
      "Precinct results missing",
      "Chain of custody break",
      "Recount petition active",
      "Canvass incomplete"
    ],
    "trainingFocus": "Chain of custody is everything. The system tracks ballot containers from printing through storage. 22-month ballot retention is statutory \u2014 the system enforces it. Recount procedures must be documented step by step.",
    "archieveFolder": "{TOWN}/TownClerk/{YEAR}/Elections/{ELECTION}/",
    "archieveNaming": "CLERK_ELEC_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "eth",
    "moduleId": "VAULT-ETH",
    "code": "ETH",
    "name": "Ethics / Conflict of Interest",
    "department": "Administration",
    "workspace": "Ethics Compliance",
    "statutoryAuthority": "MGL Ch. 268A\u2013268B",
    "retentionCode": "10.2",
    "retentionDescription": "PERMANENT \u2014 ethics compliance",
    "statutoryDeadline": "Annual disclosure; as-needed complaints",
    "summary": "Tracks ethics compliance including annual financial disclosures, conflict of interest inquiries, and complaints. Integrates with the State Ethics Commission for referrals when warranted.",
    "stages": [
      "Filing Received",
      "Review",
      "Determination (if complaint)",
      "Resolution",
      "Archive & Close"
    ],
    "keyFields": [
      "filing_type",
      "filer_name",
      "position",
      "fiscal_year",
      "description"
    ],
    "acceptanceCriteria": [
      "Filing complete",
      "Review documented",
      "Determination made (if applicable)",
      "Sealed permanent"
    ],
    "stopRules": [
      "SEC referral pending",
      "Investigation active",
      "Required disclosure not filed"
    ],
    "trainingFocus": "All municipal employees and elected/appointed officials must complete the online ethics training and file the acknowledgment. The system tracks who's current and who's delinquent. Conflict of interest determinations should involve Town Counsel. PERMANENT retention \u2014 these records never go away.",
    "archieveFolder": "{TOWN}/Ethics/{YEAR}/",
    "archieveNaming": "ETH_{TYPE}_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "grant",
    "moduleId": "VAULT-GRANT",
    "code": "GRANT",
    "name": "Grant Management",
    "department": "Finance",
    "workspace": "Grants",
    "statutoryAuthority": "2 CFR 200; MGL Ch. 44 \u00a753A",
    "retentionCode": "10.7",
    "retentionDescription": "7 years from grant closeout or per grantor requirement",
    "statutoryDeadline": "Per individual grant agreement terms",
    "summary": "Manages grants from award through closeout. Tracks Town Meeting/Board acceptance per MGL Ch. 44 \u00a753A, account setup, expenditures, reporting deadlines, and final closeout with proper documentation.",
    "stages": [
      "Award Received",
      "Authorization Vote",
      "Account Setup",
      "Implementation",
      "Reporting",
      "Closeout",
      "Archive & Close"
    ],
    "keyFields": [
      "grant_name",
      "grantor",
      "grant_number",
      "amount_awarded",
      "grant_period",
      "match_required"
    ],
    "acceptanceCriteria": [
      "Acceptance vote documented",
      "Account established",
      "All reports submitted",
      "Final closeout complete",
      "Sealed"
    ],
    "stopRules": [
      "Acceptance vote not taken",
      "Reporting deadline missed",
      "Expenditures exceed budget",
      "Match requirement not met",
      "Audit finding unresolved"
    ],
    "trainingFocus": "Every grant must be accepted per MGL Ch. 44 \u00a753A \u2014 either Town Meeting or Select Board depending on amount. The system tracks every grantor reporting deadline. Federal grants follow 2 CFR 200 \u2014 the system flags the additional requirements.",
    "archieveFolder": "{TOWN}/Finance/{YEAR}/Grants/{GRANT}/",
    "archieveNaming": "FIN_GRANT_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "hr",
    "moduleId": "VAULT-HR",
    "code": "HR",
    "name": "Personnel Action",
    "department": "Administration",
    "workspace": "Human Resources",
    "statutoryAuthority": "MGL Ch. 31; town personnel bylaw",
    "retentionCode": "10.10",
    "retentionDescription": "7 years post-separation",
    "statutoryDeadline": "Per action type",
    "summary": "Manages all personnel actions \u2014 hiring, termination, promotion, transfer, discipline, and leave. Each action is documented inside the employee's CaseSpace with proper authorization chain.",
    "stages": [
      "Action Initiated",
      "HR Review",
      "Approval",
      "Execution",
      "Archive"
    ],
    "keyFields": [
      "employee_name",
      "action_type",
      "department",
      "position_title",
      "effective_date",
      "salary",
      "approved_by"
    ],
    "acceptanceCriteria": [
      "Action documented",
      "Required approvals obtained",
      "Systems updated",
      "Sealed in personnel file"
    ],
    "stopRules": [
      "Required approval missing",
      "Civil service compliance issue",
      "Background check incomplete (hires)",
      "Grievance active"
    ],
    "trainingFocus": "Every personnel action must be in writing and in the file. Civil service positions (Ch. 31) have additional requirements \u2014 the system flags them. Disciplinary actions follow progressive discipline unless the personnel bylaw provides otherwise. 7 years post-separation means the file exists long after the employee is gone.",
    "archieveFolder": "{TOWN}/HR/{YEAR}/Personnel/{EMP}/",
    "archieveNaming": "HR_{ACTION}_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "liq",
    "moduleId": "VAULT-LIQ",
    "code": "LIQ",
    "name": "Alcohol License",
    "department": "Administration",
    "workspace": "Licensing",
    "statutoryAuthority": "MGL Ch. 138",
    "retentionCode": "10.8",
    "retentionDescription": "PERMANENT \u2014 licensing authority records",
    "statutoryDeadline": "Annual renewal + ABCC timelines",
    "summary": "Manages alcohol license applications, renewals, and transfers. Tracks public hearing requirements, Select Board decisions, and ABCC submission/approval. Violation tracking and disciplinary hearing integration.",
    "stages": [
      "Application Filed",
      "Staff Review",
      "Public Hearing",
      "Board Decision",
      "ABCC Submission",
      "License Issuance",
      "Archive & Close"
    ],
    "keyFields": [
      "establishment_name",
      "license_type",
      "manager_of_record",
      "hearing_date",
      "abcc_approval"
    ],
    "acceptanceCriteria": [
      "Application complete",
      "Hearing conducted",
      "Board decision documented",
      "ABCC approved (if required)",
      "License issued",
      "Sealed permanent"
    ],
    "stopRules": [
      "ABCC not approved",
      "Violations pending",
      "TIPS certification expired",
      "Insurance not current"
    ],
    "trainingFocus": "New licenses and transfers require ABCC approval \u2014 the system tracks the submission. Annual renewals do not require ABCC unless there's a change. Violation reports create enforcement sub-cases. The Manager of Record must have current TIPS certification.",
    "archieveFolder": "{TOWN}/Licensing/{YEAR}/Alcohol/",
    "archieveNaming": "LIC_LIQ_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "oml",
    "moduleId": "VAULT-OML",
    "code": "OML",
    "name": "Open Meeting & Board Compliance",
    "department": "Clerk / Records",
    "workspace": "Board Compliance",
    "statutoryAuthority": "MGL Ch. 30A \u00a7\u00a718\u201325",
    "retentionCode": "10.2",
    "retentionDescription": "PERMANENT \u2014 no disposition",
    "statutoryDeadline": "48-hour posting requirement before meeting",
    "summary": "Ensures full compliance with the Massachusetts Open Meeting Law for every board, committee, and commission in the municipality. From scheduling through minutes approval, the system enforces the 48-hour posting window, documents quorum, tracks executive session compliance, and applies permanent retention.",
    "stages": [
      "Meeting Scheduled",
      "Agenda Preparation",
      "Public Posting",
      "Meeting Conducted",
      "Executive Session (conditional)",
      "Draft Minutes",
      "Minutes Approval",
      "Archive & Close"
    ],
    "keyFields": [
      "board_name",
      "meeting_date",
      "meeting_time",
      "meeting_type",
      "agenda_packet_reference",
      "related_parcels",
      "executive_session_purpose",
      "quorum_required",
      "posting_deadline",
      "recording_reference"
    ],
    "acceptanceCriteria": [
      "Posted within 48-hour window",
      "Attendance/quorum recorded",
      "All items dispositioned",
      "Votes recorded",
      "Packet and map exhibits attached",
      "ES documented if applicable",
      "Minutes approved",
      "Sealed permanent"
    ],
    "stopRules": [
      "Posting deadline missed",
      "Quorum failure not documented",
      "ES without purpose citation",
      "Minutes not produced",
      "Packet or exhibit missing for posted item",
      "OML complaint active"
    ],
    "trainingFocus": "The 48-hour posting deadline is the hardest line in this module. The system calculates it automatically \u2014 but clerks must upload the agenda in time. Executive sessions require a \u00a721(a) purpose citation BEFORE entering ES. The system blocks the ES stage without it. When an item touches property, zoning, or capital work, attach the parcel/map exhibit before the packet is finalized so the room view and the archive stay in sync.",
    "archieveFolder": "{TOWN}/TownClerk/{YEAR}/BoardMeetings/{BOARD}/",
    "archieveNaming": "CLERK_{BOARD}_AGENDA_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "pay",
    "moduleId": "VAULT-PAY",
    "code": "PAY",
    "name": "Payroll Processing",
    "department": "Finance",
    "workspace": "Payroll",
    "statutoryAuthority": "MGL Ch. 41 \u00a7\u00a741\u201343",
    "retentionCode": "10.7",
    "retentionDescription": "7 years from fiscal year end",
    "statutoryDeadline": "Bi-weekly or per established pay schedule",
    "summary": "Manages the payroll cycle from timesheet collection through payment and reporting. Tracks gross/net calculations, deductions, tax withholdings, retirement contributions, and state/federal reporting.",
    "stages": [
      "Timesheet Collection",
      "Payroll Processing",
      "Review & Approval",
      "Payment",
      "Reporting",
      "Archive & Close"
    ],
    "keyFields": [
      "pay_period",
      "pay_date",
      "total_gross",
      "total_deductions",
      "total_net",
      "employee_count"
    ],
    "acceptanceCriteria": [
      "All timesheets received",
      "Calculations verified",
      "TA/Finance Dir approved",
      "Payments issued",
      "Reports filed",
      "Sealed"
    ],
    "stopRules": [
      "Missing timesheets",
      "Approval not obtained",
      "Tax deposit deadline missed",
      "Discrepancy unresolved"
    ],
    "trainingFocus": "Payroll is the most time-sensitive municipal operation. The system enforces the collection deadline \u2014 late timesheets delay the entire run. Federal/state tax deposits have hard deadlines. The TA or Finance Director must approve every run.",
    "archieveFolder": "{TOWN}/Finance/{YEAR}/Payroll/",
    "archieveNaming": "FIN_PAY_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "plan",
    "moduleId": "VAULT-PLAN",
    "code": "PLAN",
    "name": "Planning Board Review",
    "department": "Building / Land Use",
    "workspace": "Planning",
    "statutoryAuthority": "MGL Ch. 41 \u00a7\u00a781A\u201381GG",
    "retentionCode": "10.4",
    "retentionDescription": "PERMANENT \u2014 subdivision/site plan records",
    "statutoryDeadline": "Per hearing schedule + statutory deadlines",
    "summary": "Tracks Planning Board reviews including subdivisions, site plans, ANR plans, and special permits. Manages peer review, public hearings, conditions of approval, and post-decision compliance.",
    "stages": [
      "Application Filed",
      "Completeness / Peer Review",
      "Public Hearing",
      "Decision",
      "Filing & Appeal",
      "Archive & Close"
    ],
    "keyFields": [
      "applicant_name",
      "property_address",
      "review_type",
      "parcel_id",
      "hearing_date"
    ],
    "acceptanceCriteria": [
      "Application complete",
      "Hearing conducted per statute",
      "Decision rendered with conditions",
      "Filed with Clerk",
      "Appeal period expired"
    ],
    "stopRules": [
      "Peer review incomplete",
      "Required referrals pending",
      "Hearing continuance active",
      "Appeal filed"
    ],
    "trainingFocus": "Different review types have different statutory timelines. The system configures them automatically. Subdivision approval has specific requirements under the Subdivision Control Law. ANR endorsements have a 21-day deemed-approved timeline.",
    "archieveFolder": "{TOWN}/Planning/{YEAR}/{TYPE}/{CASE}/",
    "archieveNaming": "PLAN_{TYPE}_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "proc",
    "moduleId": "VAULT-PROC",
    "code": "PROC",
    "name": "Procurement",
    "department": "Finance",
    "workspace": "Procurement",
    "statutoryAuthority": "MGL Ch. 30B; Ch. 149; Ch. 30 \u00a739M",
    "retentionCode": "10.7",
    "retentionDescription": "7 years from contract completion",
    "statutoryDeadline": "Per threshold \u2014 Ch. 30B determines method and timeline",
    "summary": "Complete procurement lifecycle per Massachusetts law. Threshold-based routing determines the procurement method \u2014 sound business practices, quotes, sealed bids, or RFP. Construction procurement follows Ch. 149 and Ch. 30 \u00a739M for filed sub-bids.",
    "stages": [
      "Requisition",
      "Threshold Determination",
      "Solicitation",
      "Evaluation",
      "Award",
      "Contract Execution",
      "Performance & Payment",
      "Archive & Close"
    ],
    "keyFields": [
      "procurement_type",
      "description",
      "estimated_value",
      "threshold",
      "department",
      "funding_source"
    ],
    "acceptanceCriteria": [
      "Proper method applied per threshold",
      "Evaluation documented",
      "Award notice issued",
      "Contract executed",
      "Deliverables accepted",
      "Payment processed",
      "Sealed"
    ],
    "stopRules": [
      "Wrong procurement method for threshold",
      "Bid protest active",
      "Contract not executed before work",
      "Insurance/bonding not on file",
      "MCPPO certification issue"
    ],
    "trainingFocus": "Threshold determines everything. Under $10K: sound business practices. $10K\u2013$50K: three written quotes. Over $50K: sealed bids or RFP. Construction has separate thresholds under Ch. 149. The MCPPO-certified officer must sign off. The system prevents threshold errors.",
    "archieveFolder": "{TOWN}/Finance/{YEAR}/Procurement/{CASE}/",
    "archieveNaming": "FIN_PROC_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "prr",
    "moduleId": "VAULT-PRR",
    "code": "PRR",
    "name": "Public Records Request",
    "department": "Clerk / Records",
    "workspace": "Public Records",
    "statutoryAuthority": "MGL Ch. 66 \u00a710",
    "retentionCode": "10.6",
    "retentionDescription": "7 years from date of final response",
    "statutoryDeadline": "10 business days from receipt of request",
    "summary": "Governs the complete lifecycle of public records requests under the Massachusetts Public Records Law. From intake through response delivery, every step is tracked, every deadline enforced, and every exemption documented. The 10-business-day clock starts at receipt and the system does not let you forget it.",
    "stages": [
      "Intake & Receipt",
      "Triage & Assignment",
      "Records Search",
      "Legal / Exemption Review",
      "Response Preparation",
      "Response Delivery",
      "Archive & Close"
    ],
    "keyFields": [
      "requestor_name",
      "requestor_email",
      "response_format",
      "department_targeted",
      "records_description",
      "deadline_date"
    ],
    "acceptanceCriteria": [
      "All responsive records uploaded or non-responsive documented",
      "Exemption review complete",
      "Response delivered in chosen format",
      "Delivery confirmed",
      "No open appeal",
      "Sealed in ARCHIEVE"
    ],
    "stopRules": [
      "Deadline passed with no response/extension",
      "Legal review incomplete on flagged exemptions",
      "Delivery not confirmed",
      "Appeal active",
      "Fee unresolved"
    ],
    "trainingFocus": "Staff must understand the 10-business-day statutory clock is non-negotiable. Extension to 15 days requires documented good cause and written notice to requestor before day 10. Every response goes through the CaseSpace \u2014 never via personal email.",
    "archieveFolder": "{TOWN}/TownClerk/{YEAR}/PublicRecordsRequests/",
    "archieveNaming": "CLERK_PRR_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "rec",
    "moduleId": "VAULT-REC",
    "code": "REC",
    "name": "Parks & Recreation",
    "department": "Health & Human Services",
    "workspace": "Recreation",
    "statutoryAuthority": "Town bylaw; revolving fund authorization",
    "retentionCode": "10.8",
    "retentionDescription": "3 years from program year end",
    "statutoryDeadline": "Registration-based",
    "summary": "Tracks recreation program registration, fee collection, waiver management, and attendance. Revolving fund accounting integration ensures proper financial tracking.",
    "stages": [
      "Registration",
      "Program Delivery",
      "Program Completion",
      "Archive & Close"
    ],
    "keyFields": [
      "program_name",
      "participant_name",
      "participant_age",
      "guardian_name",
      "fee",
      "waiver_signed"
    ],
    "acceptanceCriteria": [
      "Registration complete",
      "Waiver signed",
      "Fee collected",
      "Attendance documented",
      "Sealed"
    ],
    "stopRules": [
      "Waiver not signed (minors)",
      "Fee not collected",
      "Capacity exceeded"
    ],
    "trainingFocus": "No minor participates without a signed waiver \u2014 the system enforces this. Revolving fund revenue must be tracked per program. Capacity limits are hard \u2014 the system stops registration at the cap.",
    "archieveFolder": "{TOWN}/Recreation/{YEAR}/Programs/",
    "archieveNaming": "REC_{PROG}_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "tax",
    "moduleId": "VAULT-TAX",
    "code": "TAX",
    "name": "Tax Abatement / Exemption",
    "department": "Finance",
    "workspace": "Assessor",
    "statutoryAuthority": "MGL Ch. 59 \u00a7\u00a759\u201365D",
    "retentionCode": "10.7",
    "retentionDescription": "7 years from decision",
    "statutoryDeadline": "3 months from application filing date",
    "summary": "Tracks property tax abatement and exemption applications from filing through Board of Assessors decision. Manages the 3-month statutory deadline, optional hearings, and the ATB appeal pathway.",
    "stages": [
      "Application Filed",
      "Assessor Review",
      "Hearing (optional)",
      "Decision",
      "ATB Appeal Period",
      "Archive & Close"
    ],
    "keyFields": [
      "property_address",
      "parcel_id",
      "application_type",
      "fiscal_year",
      "assessed_value",
      "exemption_type"
    ],
    "acceptanceCriteria": [
      "Application reviewed",
      "Decision rendered and documented",
      "Applicant notified",
      "Appeal period expired",
      "Sealed"
    ],
    "stopRules": [
      "3-month deadline breached",
      "ATB appeal active",
      "Supporting documentation missing"
    ],
    "trainingFocus": "The 3-month decision deadline is statutory \u2014 if the Board doesn't act, it's deemed denied and the applicant can appeal to ATB. Each exemption clause has specific eligibility requirements. The system maps them automatically.",
    "archieveFolder": "{TOWN}/Assessor/{YEAR}/Abatements/{CASE}/",
    "archieveNaming": "TAX_ABATE_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "tm",
    "moduleId": "VAULT-TM",
    "code": "TM",
    "name": "Town Meeting Warrant",
    "department": "Clerk / Records",
    "workspace": "Town Meeting",
    "statutoryAuthority": "MGL Ch. 39 \u00a7\u00a79\u201310",
    "retentionCode": "10.2",
    "retentionDescription": "PERMANENT \u2014 no disposition",
    "statutoryDeadline": "Warrant posting 14 days before Town Meeting",
    "summary": "Manages the complete Town Meeting warrant cycle from opening through results certification. Tracks article submission, Board review, warrant posting, voting, and permanent archiving.",
    "stages": [
      "Warrant Opened",
      "Article Submission",
      "Board Review",
      "Warrant Posting",
      "Town Meeting",
      "Results Certified",
      "Archive & Close"
    ],
    "keyFields": [
      "meeting_type",
      "meeting_date",
      "warrant_articles",
      "moderator",
      "quorum_required",
      "warrant_posted_date"
    ],
    "acceptanceCriteria": [
      "All articles acted upon",
      "Votes recorded",
      "Results certified by Clerk",
      "Permanent archive sealed"
    ],
    "stopRules": [
      "Warrant not posted 14 days prior",
      "Quorum not achieved",
      "Results not certified"
    ],
    "trainingFocus": "The 14-day posting requirement is statutory. The system calculates it from the meeting date. Every article must have a recorded disposition \u2014 discussed, voted, tabled, or indefinitely postponed. Results certification is the Clerk's statutory duty.",
    "archieveFolder": "{TOWN}/TownClerk/{YEAR}/TownMeeting/",
    "archieveNaming": "CLERK_TM_WARRANT_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "util",
    "moduleId": "VAULT-UTIL",
    "code": "UTIL",
    "name": "Street Opening / Utility Permit",
    "department": "Public Works",
    "workspace": "DPW Permits",
    "statutoryAuthority": "Town bylaw; MGL Ch. 82",
    "retentionCode": "10.9",
    "retentionDescription": "5 years from permit close",
    "statutoryDeadline": "Per permit type and conditions",
    "summary": "Manages street opening and utility permits. Tracks the permit from application through work completion and street restoration. Bond management ensures the town is protected if the applicant doesn't restore properly.",
    "stages": [
      "Permit Application",
      "DPW Review",
      "Permit Issuance",
      "Work Period",
      "Restoration",
      "Bond Release",
      "Archive & Close"
    ],
    "keyFields": [
      "applicant_name",
      "street_name",
      "work_description",
      "start_date",
      "end_date",
      "bond_amount",
      "restoration_plan"
    ],
    "acceptanceCriteria": [
      "Permit conditions met",
      "Work completed per plan",
      "Street restored to standard",
      "DPW inspection passed",
      "Bond released",
      "Sealed"
    ],
    "stopRules": [
      "Restoration not to standard",
      "Work exceeded permit scope",
      "Bond not on file",
      "Inspection failed"
    ],
    "trainingFocus": "No dig without a permit. The bond protects the town \u2014 don't release it until the DPW Director confirms restoration quality. Winter moratoriums may apply. The system tracks the restoration warranty period.",
    "archieveFolder": "{TOWN}/DPW/{YEAR}/StreetOpenings/",
    "archieveNaming": "DPW_UTIL_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "vit",
    "moduleId": "VAULT-VIT",
    "code": "VIT",
    "name": "Vital Records",
    "department": "Clerk / Records",
    "workspace": "Vital Records",
    "statutoryAuthority": "MGL Ch. 46 \u00a7\u00a71\u201317",
    "retentionCode": "10.1",
    "retentionDescription": "PERMANENT \u2014 no disposition",
    "statutoryDeadline": "Per state registry standards",
    "summary": "Manages birth, death, marriage, and intention records with permanent retention and state registry integration. These are among the most sensitive records a municipality holds.",
    "stages": [
      "Record Received",
      "Verification",
      "State Registration",
      "Permanent Archive"
    ],
    "keyFields": [
      "record_type",
      "event_date",
      "primary_name",
      "registrar_name",
      "state_registry_id"
    ],
    "acceptanceCriteria": [
      "Record verified against source",
      "State registry transmission complete",
      "Permanent archive sealed"
    ],
    "stopRules": [
      "Source document missing",
      "State registry rejection",
      "Verification incomplete"
    ],
    "trainingFocus": "Permanent retention \u2014 these records never go away. Access is restricted per MGL Ch. 46 \u00a72A. Staff must verify identity before issuing certified copies. State registry integration must be confirmed for every record.",
    "archieveFolder": "{TOWN}/TownClerk/VitalRecords/{TYPE}/{YEAR}/",
    "archieveNaming": "CLERK_VIT_{TYPE}_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "zba",
    "moduleId": "VAULT-ZBA",
    "code": "ZBA",
    "name": "Zoning Board of Appeals",
    "department": "Building / Land Use",
    "workspace": "Zoning",
    "statutoryAuthority": "MGL Ch. 40A \u00a7\u00a712\u201316",
    "retentionCode": "10.4",
    "retentionDescription": "PERMANENT \u2014 land use decisions",
    "statutoryDeadline": "65 days from close of public hearing",
    "summary": "Manages ZBA petitions \u2014 variances, special permits, appeals, and comprehensive permits (40B). Tracks legal notice requirements, hearing procedures, deliberation, and the 20-day appeal period.",
    "stages": [
      "Application Filed",
      "Legal Notice",
      "Public Hearing",
      "Deliberation",
      "Decision",
      "Filing & Appeal Period",
      "Archive & Close"
    ],
    "keyFields": [
      "applicant_name",
      "property_address",
      "petition_type",
      "zoning_district",
      "hearing_date",
      "legal_notice_date"
    ],
    "acceptanceCriteria": [
      "Legal notice published per statute",
      "Hearing conducted",
      "Written decision issued",
      "Filed with Clerk",
      "Appeal period expired",
      "Sealed permanent"
    ],
    "stopRules": [
      "Legal notice not published in time",
      "Decision not filed within 14 days",
      "Appeal active",
      "Hearing not properly noticed"
    ],
    "trainingFocus": "Legal notice requirements are strict \u2014 published in newspaper and mailed to abutters. The 65-day decision deadline runs from close of hearing, not from filing. Written decisions must cite specific findings of fact. All decisions are permanent records.",
    "archieveFolder": "{TOWN}/ZBA/{YEAR}/{CASE}/",
    "archieveNaming": "ZBA_{TYPE}_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained \u2014 Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "par",
    "moduleId": "VAULT-PAR",
    "code": "PAR",
    "name": "Personnel Action Request",
    "department": "HR / Town Administrator",
    "workspace": "Personnel Actions",
    "statutoryAuthority": "MGL Ch. 41 §108A; Personnel Bylaws; Ch. 149 wage law",
    "retentionCode": "10.3y",
    "retentionDescription": "3 years after employee separation",
    "statutoryDeadline": "Wage changes effective upon TA approval; appointments effective upon acceptance and oath",
    "summary": "Unified intake for all personnel actions: new hires, wage adjustments, resignations, and official appointments. Routes to TA + HR for approval with required documentation per action type. Replaces ad-hoc email submissions and disconnected paper trails.",
    "stages": [
      "Submission",
      "Document Review",
      "HR Review",
      "TA Approval",
      "HR Processing",
      "Notification",
      "Archive & Close"
    ],
    "keyFields": [
      "action_type",
      "employee_name",
      "position_title",
      "department",
      "effective_date",
      "wage_rate",
      "union_status",
      "required_documents"
    ],
    "acceptanceCriteria": [
      "Action type selected (New Hire / Wage Adj / Resignation / Appointment)",
      "All required documents uploaded per action type",
      "HR reviewed position classification",
      "TA signed approval",
      "Employee notified",
      "Payroll updated",
      "Sealed and archived"
    ],
    "stopRules": [
      "Missing CORI for new hire",
      "Missing oath for appointed official",
      "Wage rate exceeds approved classification",
      "Budget line not confirmed by Accountant",
      "Incomplete documentation uploaded"
    ],
    "trainingFocus": "Every personnel action — from hiring to resignation — must go through this form. Do not submit wage changes by email. The TA is the approving authority for all hires and wage adjustments. Appointed officials require oath of office before assuming duties (MGL Ch. 41). Retention is 3 years after separation, not 3 years from event.",
    "archieveFolder": "{TOWN}/HR/{YEAR}/PersonnelActions/",
    "archieveNaming": "PAR_{ACTIONTYPE}_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained — Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  },
  {
    "id": "sup",
    "moduleId": "VAULT-SUP",
    "code": "SUP",
    "name": "Supply Request",
    "department": "All Departments",
    "workspace": "Operations / Supply",
    "statutoryAuthority": "Local procurement policy; MGL Ch. 30B (threshold-aware)",
    "retentionCode": "10.3",
    "retentionDescription": "3 years",
    "statutoryDeadline": "No statutory deadline; internal SLA typically 5–10 business days",
    "summary": "Standardized supply request workflow for all departments. Captures item category, quantity, justification, and budget line. Routes to department head and, above threshold, to Town Administrator. Eliminates ad-hoc verbal requests and ensures procurement compliance awareness.",
    "stages": [
      "Request Submitted",
      "Department Head Review",
      "Budget Verification",
      "TA Approval (if threshold exceeded)",
      "Purchase Ordered",
      "Receipt Confirmed",
      "Archive & Close"
    ],
    "keyFields": [
      "department",
      "requestor_name",
      "item_category",
      "item_description",
      "quantity",
      "estimated_cost",
      "budget_line",
      "justification"
    ],
    "acceptanceCriteria": [
      "Item category selected",
      "Estimated cost entered",
      "Budget line confirmed",
      "Department head approved",
      "TA notified if cost exceeds threshold",
      "Purchase confirmed by vendor",
      "Receipt documented",
      "Sealed and archived"
    ],
    "stopRules": [
      "Budget line not identified",
      "Estimated cost exceeds $10,000 without TA approval",
      "Item requires bid process (Ch. 30B threshold)",
      "Duplicate request already open"
    ],
    "trainingFocus": "All supply requests go through this form — no verbal orders, no personal card purchases without prior approval. Know your department's budget line before submitting. Requests above $10,000 require TA review and may trigger Ch. 30B procurement requirements. If in doubt, ask before ordering.",
    "archieveFolder": "{TOWN}/Operations/{YEAR}/SupplyRequests/",
    "archieveNaming": "SUP_{DEPT}_{DATE}_{SEQ}_v{#}.pdf",
    "deploymentPrerequisites": [
      "PL Diagnostic complete",
      "VAULT Foundations installed",
      "FormKey schema approved by Nate",
      "Encoding partner has schema + ARCHIEVE manifest",
      "Partner signed governance boundary agreement",
      "All stage actors named and notified",
      "Escalation paths tested",
      "SEAL chain initialized",
      "ARCHIEVE folder structure created",
      "Staff trained — Training Guide delivered",
      "Quick Reference Cards distributed",
      "Escalation Playbook delivered to supervisors",
      "Transfer/Exit criteria defined"
    ]
  }
]
