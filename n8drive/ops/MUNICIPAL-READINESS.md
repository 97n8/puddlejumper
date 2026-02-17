# Municipal Readiness Criteria

**Version:** February 2026
**System:** PuddleJumper Governance Control Plane

---

## Readiness Tiers

### Tier 1: Alpha Ready

**Current status: ✅ Achieved**

The system is functional and suitable for internal testing and development.

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Core approval workflow functional | ✅ | 500+ tests passing |
| Multi-step approval chains | ✅ | Chain templates with parallel support |
| OAuth login (3 providers) | ✅ | GitHub, Google, Microsoft |
| RBAC enforcement | ✅ | Owner/Admin/Member/Viewer roles |
| CSRF protection | ✅ | Token-based CSRF middleware |
| SQLite WAL mode | ✅ | All databases use WAL |
| Health endpoint | ✅ | `/health` with DB + volume checks |
| CI pipeline | ✅ | Tests, typecheck, build on every PR |

---

### Tier 2: Internal Municipal Pilot Ready

**Current status: 🔄 In progress**

The system is hardened sufficiently for a controlled pilot with a single municipality
under supervision.

| Criterion | Status | Evidence |
|-----------|--------|----------|
| No cold starts (min 1 machine) | ✅ | `fly.toml` min_machines_running = 1 |
| Graceful shutdown handling | ✅ | SIGTERM/SIGINT handlers with 10s grace |
| Health/readiness separation | ✅ | `/health` (deep) + `/ready` (lightweight) |
| JWT secret minimum length (32 chars) | ✅ | Startup validation via Zod |
| Security headers (HSTS, Referrer-Policy, CSP, X-Content-Type-Options) | ✅ | Middleware enforced |
| Audit event logging | ✅ | All auth and governance events logged |
| Audit export (CSV/JSON) | ✅ | `GET /api/admin/audit/export` |
| SQLite durability pragmas | ✅ | synchronous=NORMAL, WAL, autocheckpoint |
| Rate limiting (persistent) | ✅ | SQLite-backed rate limiter |
| Idempotent webhook handling | ✅ | IdempotencyStore with TTL |
| Prometheus metrics endpoint | ✅ | `/metrics` with optional auth |
| Alert rules defined | ✅ | 6 Prometheus alert rules |
| Operational runbooks | ✅ | Approval, chain-stuck, DB restore |
| Disaster recovery plan | ✅ | RTO ≤30min, RPO ≤6h |
| Backup strategy documented | ✅ | Every 6h, 30-day retention |
| Operational handoff doc | ✅ | Complete "bus factor" documentation |
| OAuth redirect URI validation | ✅ | Startup validation in production |

**SLA for Pilot:**
- Availability: 99% (allows 7.3h downtime/month for maintenance)
- Approval processing: Best-effort, no guaranteed processing time
- Backup verification: Weekly
- Incident response: Next business day

---

### Tier 3: Production Municipal Deployment Ready

**Target date:** To be determined based on pilot feedback

The system meets all requirements for unsupervised production use by
municipal staff handling public records and access control workflows.

| Criterion | Required | Status |
|-----------|----------|--------|
| All Tier 2 criteria met | Required | ✅ |
| Automated backup verification | Required | 🔲 Scheduled weekly restore test |
| Email delivery for invitations | Required | 🔲 Transactional email integration |
| Notification integrations (Slack/Teams) | Required | 🔲 Dispatcher stubs exist |
| Multi-region backup strategy | Recommended | 🔲 Backup to secondary region |
| Penetration test completed | Required | 🔲 Third-party security audit |
| Accessibility audit (WCAG 2.1 AA) | Required | 🔲 Automated checks in CI |
| Data retention policy documented | Required | ✅ Documented in DR plan |
| Privacy impact assessment | Required | 🔲 PIA for PII handling |
| Incident response SLA defined | Required | 🔲 Formal SLA document |
| Load testing completed | Recommended | 🔲 Governance workload characterization |

**SLA for Production:**
- Availability: 99.5% (allows 3.7h downtime/month)
- Approval processing guarantee: Approvals processed within 5 minutes of submission
- Backup verification: Weekly automated, monthly manual
- Incident response: SEV-1 within 1 hour, SEV-2 within 4 hours
- Data retention: Audit logs retained ≥7 years (municipal records requirement)

---

## Monitoring Coverage Requirements

| Category | Metric | Alert Threshold |
|----------|--------|-----------------|
| Availability | Health check | Failure for >2 consecutive checks |
| Approvals | Pending backlog | >10 pending for >10 minutes |
| Approvals | Stuck chain steps | Pending >24 hours |
| Dispatch | Failure rate | >5 failures in 5 minutes |
| Dispatch | Latency p95 | >60 seconds |
| Auth | OAuth callback failures | >3 failures in 5 minutes |
| Database | Write failures | Any write failure |

---

## Compliance Positioning

PuddleJumper is designed to support Massachusetts municipal governance workflows
with the following compliance posture:

1. **Audit Trail:** All governance decisions, approval actions, and authentication
   events are logged to an immutable audit store with timestamps and actor identification.

2. **Access Control:** Role-based access control (RBAC) enforces separation of duties.
   Only designated approvers can approve actions. Only admins can manage workspace settings.

3. **Data Durability:** SQLite WAL mode with synchronous writes ensures data persists
   through process crashes. Automated backups provide point-in-time recovery.

4. **Idempotency:** Webhook event processing is idempotent — duplicate deliveries
   do not cause duplicate actions. CAS (compare-and-swap) prevents double-dispatch.

5. **Session Security:** JWT tokens with minimum 32-character secrets, CSRF protection,
   secure cookie settings, and session revocation support.

6. **Transport Security:** HTTPS enforced, HSTS with preload, strict Referrer-Policy,
   Content Security Policy headers.
