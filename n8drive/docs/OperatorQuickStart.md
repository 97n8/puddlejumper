# CivicPulse — Operator Quick Start
*Estimated completion time: 2–4 hours | Required before CivicPulse activation*

---

## Before You Begin

CivicPulse is active the moment it is enabled. ARCHIEVE begins monitoring VAULT records immediately. Confirm the following with your PublicLogic installer before proceeding:

- [ ] VAULT Foundations installation is complete and accepted
- [ ] VAULT Workspaces (Board Compliance, Fiscal at minimum) are active
- [ ] ARCHIEVE rule set has been reviewed and signed off
- [ ] Output channels are configured (website post + activity feed minimum)
- [ ] Your operator account has been provisioned in LogicOS

---

## Part 1: Understanding the Governance Chain (30 min)

CivicPulse moves automatically through this chain:

1. **VAULT record created** — a vote, contract, or financial action is logged
2. **ARCHIEVE evaluates** — determines if the action meets publication threshold
3. **Summary generated** — plain-language civic summary produced from record fields
4. **SEAL validates** — integrity hash generated; any post-generation change is flagged
5. **Routing decision** — auto-release, staff review queue, or legal hold
6. **You act** — approve, reject, or clear legal hold
7. **Published + logged** — output to configured channels; event logged in audit chain

**Your role:** You are the approval gate for staff review items. You are not the starting point — ARCHIEVE detects and generates before you see anything. Your job is review, not authoring.

---

## Part 2: The Approval Queue (45 min)

Navigate to **LogicOS → CivicPulse → Approval Queue**.

### What you'll see:
- **Legal Holds** — summaries held pending counsel review. You cannot approve these. Contact counsel and use the Legal Clearance workflow.
- **Pending Review** — summaries awaiting your approval before publication.
- **SEAL Mismatch warnings** — if the source VAULT record was modified after the summary was generated, the Approve button will be disabled. Contact your PublicLogic installer.

### For each pending summary:
1. Read the headline and body
2. Verify the structured data (financial amount, funding source, vote margin) matches what you know occurred
3. Click the VAULT record link to confirm against source
4. Add optional notes if needed
5. Approve to publish, or Reject with a reason

**If something looks wrong:** Reject the summary with a note. Do not approve inaccurate content.
**AI-assisted summaries:** Always go to staff review. Review them as you would any summary — AI assist improves language, not governance accuracy.

---

## Part 3: Compliance Backstop (30 min)

Navigate to **LogicOS → CivicPulse → Compliance Alerts**.

If a Publication Required action (board vote, contract award, etc.) reaches its configured time window without entering the approval workflow, CivicPulse will prompt you here.

### Alert types:
- **Approaching** — you have time to act; the summary is in the queue
- **Overdue** — window has passed; this will auto-escalate to your department head

**What to do:** Go to the Approval Queue and process the flagged item. If you cannot find it in the queue, contact your PublicLogic installer — this may indicate a VAULT record issue.

---

## Part 4: The Town Activity Feed (20 min)

Navigate to your municipality's public feed (URL provided by your installer).

This is the public-facing surface. Published summaries appear here automatically. The feed is:
- Searchable by keyword
- Filterable by action type and department
- Linked to source VAULT records

You do not maintain the feed manually. It maintains itself from published summaries. If an entry is incorrect, contact your PublicLogic installer — corrections create versioned records and do not delete originals.

---

## Part 5: Audit Log (15 min)

Navigate to **LogicOS → CivicPulse → Publication Log**.

The log shows every publication event: what was published, when, to which channel, by whom, and the SEAL hash for that version. This log is append-only and cannot be edited.

To export: click **Export Audit Log**. The export is a dated JSON file suitable for records requests or legal review.

---

## Common Questions

**Q: A vote happened but no summary appeared in my queue.**
A: Check that the VAULT record for the vote was created and that the action type is not excluded in your rule set. Contact your installer if the record exists but no summary was generated.

**Q: The Approve button is greyed out.**
A: The summary has a SEAL mismatch — the source VAULT record was modified after the summary was generated. Do not publish until the mismatch is resolved. Contact your installer.

**Q: I approved something that had an error.**
A: Contact your PublicLogic installer. Corrections are versioned — the original is not deleted. A corrected version can be generated and go through the approval workflow again.

**Q: Can I edit the summary text before approving?**
A: Minor edits are permitted within the bounds of the source record. The edit field is in the review card. Any edit triggers re-SEAL before publication. You cannot publish content that contradicts the underlying VAULT record.

---

## Certification Checklist

Before sign-off, confirm you have:

- [ ] Located and reviewed at least one item in the Approval Queue
- [ ] Reviewed a VAULT record source link
- [ ] Reviewed the Compliance Alerts panel
- [ ] Located the Town Activity Feed and confirmed a published entry
- [ ] Accessed the Publication Log and exported a test record
- [ ] Confirmed escalation contact configuration with your installer

Operator certification sign-off: _______________________ Date: _______________
