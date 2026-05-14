# CivicPulse — PuddleJumper Deployment Checklist
*Installation Gate Checklist + Transfer & Exit Criteria*
*PublicLogic LLC | Confidential*

---

## Pre-Activation Gates

All gates must be complete and signed off before CivicPulse activation. This is not a soft launch. When CivicPulse is on, ARCHIEVE begins monitoring immediately.

### Gate 1: VAULT Foundations Complete
- [ ] Authority structures installed and accepted
- [ ] Accountability structures installed and accepted
- [ ] Boundary structures installed and accepted
- [ ] Continuity structures installed and accepted
- [ ] Acceptance criteria signed by authorized municipal representative

### Gate 2: VAULT Workspaces Scoped
- [ ] Board Compliance workspace active
- [ ] Fiscal workspace active
- [ ] Additional workspaces identified and scoped (if applicable)

### Gate 3: ARCHIEVE Rule Set
- [ ] Rule set drafted for all action types
- [ ] Publication Required / Recommended / No Action tiers confirmed per action type
- [ ] Backstop windows configured per action type
- [ ] Legal hold designations confirmed
- [ ] Excluded action types documented (if any)
- [ ] Rule set version-controlled in municipality VAULT environment
- [ ] **Rule set signed off by authorized municipal representative**: _______________________ Date: ___________

### Gate 4: SEAL Initialized
- [ ] SEAL integrity framework active
- [ ] Canonical field list confirmed and documented
- [ ] SEAL validation confirmed on test record

### Gate 5: Output Channels Configured
- [ ] Website post: CMS endpoint configured and tested
- [ ] Town Activity Feed: enabled and accessible at public URL
- [ ] Weekly digest: recipient list confirmed (or disabled)
- [ ] Email summary: recipient list by action type confirmed (or disabled)
- [ ] Social draft: operator review queue confirmed (or disabled)
- [ ] Quarterly report: enabled/disabled confirmed
- [ ] All channel credentials transferred to municipality ownership

### Gate 6: Approval Workflow Configured
- [ ] Auto-release action types confirmed
- [ ] Staff review action types confirmed
- [ ] Legal hold action types confirmed
- [ ] Escalation contacts configured: Primary _______________________ Escalation _______________________
- [ ] Backstop prompt thresholds confirmed

### Gate 7: Operator Readiness
- [ ] Designated operator(s) identified: _______________________
- [ ] Operator Quick Start training completed
- [ ] Operator certification signed
- [ ] Operator account provisioned in LogicOS with appropriate permissions

---

## Activation Event

CivicPulse activation is logged by PuddleJumper. Record the following:

- Activation date/time: _______________________
- Activating installer: _______________________
- Municipality config version: _______________________
- Rule set version: _______________________
- PJ deployment manifest version: _______________________

---

## Post-Activation Verification (Day 1)

- [ ] ARCHIEVE monitoring confirmed active (check PJ logs)
- [ ] Test VAULT record created → summary generated → appeared in approval queue
- [ ] SEAL hash generated and validated on test summary
- [ ] Approval workflow exercised: approve one, reject one
- [ ] Town Activity Feed shows published test entry
- [ ] Backstop monitor confirmed active
- [ ] Audit log shows test publication events

---

## Monitored Operation Period (30 Days)

Before transfer is complete, the following must be observed over 30 days of live operation:

- [ ] No unresolved SEAL flags
- [ ] No unresolved compliance holds (or resolved appropriately with log entries)
- [ ] Operator processed at least 10 approval queue items independently
- [ ] At least one compliance backstop prompt occurred and was resolved
- [ ] Audit log exported and reviewed by operator at least once
- [ ] No PublicLogic intervention required for routine operation after Day 7

Monitored period start: _______________________
Monitored period end: _______________________
Monitoring sign-off: _______________________

---

## Transfer & Exit Criteria

Transfer is not complete until all criteria below are signed. CivicPulse is load-bearing. It does not transfer on a handshake.

- [ ] Designated operator trained, certified, and independently operating
- [ ] ARCHIEVE rule set documented, version-controlled, and in municipality's VAULT environment
- [ ] Rule set import/export tested — municipality can independently update thresholds
- [ ] PJ audit chain verified and operator-accessible without PublicLogic involvement
- [ ] All output channel credentials confirmed municipality-owned
- [ ] Escalation contact configuration confirmed and tested
- [ ] Correction workflow demonstrated: municipality can initiate a correction version
- [ ] LogicOS operator documentation present and accessible to municipality staff
- [ ] 30-day monitored operation period complete per criteria above
- [ ] No open SEAL flags at time of transfer
- [ ] No open compliance holds at time of transfer

**Transfer sign-off**

Municipality representative: _______________________ Date: ___________
PublicLogic installer: _______________________ Date: ___________

---

*This checklist is a municipality record. Retain with VAULT Foundations documentation.*
*PublicLogic LLC | Confidential | Not for distribution without NDA*
