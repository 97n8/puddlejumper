import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import Guardrails from "./Guardrails.jsx";

function ValidationChecks({ checks }) {
  if (!checks?.length) {
    return null;
  }

  return (
    <section className="review-section">
      <h3>Validation Checks</h3>
      <ul className="checklist">
        {checks.map((item) => (
          <li key={item.id} className={item.ok ? "check-ok" : "check-warning"}>
            <span>{item.ok ? "\u2713" : "\u2717"}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TenantIsolation({ tenantIsolation }) {
  if (!tenantIsolation?.checks?.length) {
    return null;
  }

  return (
    <section className="review-section">
      <h3>Tenant Isolation Tests (5 Categories)</h3>
      <p className="subtle">
        Isolation checks verify tenant boundary, authority boundary, canonical boundary, and environment scope.
      </p>
      <ul className="checklist">
        {tenantIsolation.checks.map((item) => (
          <li key={item.id} className={item.ok ? "check-ok" : "check-warning"}>
            <span>{item.ok ? "\u2713" : "\u2717"}</span>
            <span>
              {item.label} <em>({item.category})</em>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmergencyDeclarationNotice({ emergencyDeclaration }) {
  if (!emergencyDeclaration) {
    return null;
  }

  return (
    <section className="review-section">
      <h3>Emergency Declaration</h3>
      <p className="subtle">
        Compressed review mode is active for incident <strong>{emergencyDeclaration.incidentId}</strong>.
      </p>
      <p className="subtle">
        Declared by {emergencyDeclaration.declaredBy} at{" "}
        {new Date(emergencyDeclaration.declaredAt).toLocaleString()}.
      </p>
      <p className="subtle">
        Post-action review due by{" "}
        {new Date(emergencyDeclaration.postActionReviewDueAt).toLocaleString()}.
      </p>
    </section>
  );
}

function Structures({ diff }) {
  return (
    <section className="review-section">
      <h3>Structures Created</h3>
      {(diff.structures || []).map((structure, index) => (
        <div className="structure-item" key={`${structure.type}-${index}`}>
          <h4>{structure.type}</h4>
          {structure.name ? <p>Name: {structure.name}</p> : null}
          {structure.location ? <p>Location: {structure.location}</p> : null}
          {structure.permissionBoundary ? <p>Permission Boundary: {structure.permissionBoundary}</p> : null}
          {structure.items?.length ? (
            <ul>
              {structure.items.map((item) => (
                <li key={item.name || item}>{item.name ? `${item.name}: ${item.purpose}` : item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function Artifacts({ artifacts }) {
  return (
    <section className="review-section">
      <h3>Artifacts Deployed</h3>
      <ul>
        {(artifacts || []).map((artifact) => (
          <li key={artifact}>{artifact}</li>
        ))}
      </ul>
    </section>
  );
}

function PermissionMappings({ permissions }) {
  return (
    <section className="review-section">
      <h3>Authority Mappings</h3>
      <ul>
        {(permissions || []).map((item) => (
          <li key={item.role}>
            {item.role}: {item.group} \u2192 {item.access}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExplicitGatesChecklist({ gates }) {
  if (!Array.isArray(gates) || gates.length === 0) {
    return null;
  }

  return (
    <section className="review-section">
      <h3>Explicit Gates Checklist</h3>
      <ul className="explicit-gates-list">
        {gates.map((gate) => (
          <li key={gate.id} className="explicit-gate-item">
            <span className={`explicit-gate-icon${gate.complete ? " explicit-gate-ok" : ""}`}>
              <CheckCircle2 size={16} />
            </span>
            <div>
              <p className="explicit-gate-label">{gate.label}</p>
              {gate.href ? (
                <a href={gate.href} className="explicit-gate-link">
                  {gate.detail}
                </a>
              ) : (
                <p className="subtle">{gate.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function GovernanceDiff({
  open,
  loading,
  error,
  diff,
  explicitGates,
  deploymentReason,
  onDeploymentReasonChange,
  reasonTooShort,
  typedClientShortName,
  onTypedClientShortNameChange,
  onGuardrailToggle,
  guardrailAcknowledgments,
  deploying,
  canDeploy,
  onCancel,
  onDeploy
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card governance-modal">
        <h2>Governance Review</h2>
        <p className="subtle">
          Review governance impact in plain language before deployment. This is the required human checkpoint.
        </p>

        {loading ? <p className="notice">Building governance review...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {!loading && !error && diff ? (
          <>
            <p className="summary-block">{diff.readableSummary}</p>
            <EmergencyDeclarationNotice emergencyDeclaration={diff.emergencyDeclaration} />
            <TenantIsolation tenantIsolation={diff.tenantIsolation} />
            <Structures diff={diff} />
            <Artifacts artifacts={diff.artifacts} />
            <PermissionMappings permissions={diff.permissions} />

            {diff.warnings?.length ? (
              <section className="review-section">
                <h3>Warnings</h3>
                <ul>
                  {diff.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <ValidationChecks checks={diff.validations?.checks} />

            <Guardrails
              guardrails={diff.guardrails || []}
              acknowledgments={guardrailAcknowledgments}
              onToggle={onGuardrailToggle}
            />

            <section className="review-section">
              <h3>Deployment Intent</h3>
              <p>Describe why this deployment is needed right now.</p>
              <textarea
                value={deploymentReason}
                onChange={(event) => onDeploymentReasonChange(event.target.value)}
                placeholder="Example: Correct production redirect URI mismatch after municipal sign-off."
              />
              <p className="subtle">Minimum 8 characters. Keep it specific and audit-ready.</p>
              {reasonTooShort ? (
                <p className="error">Deployment intent is required before deployment.</p>
              ) : null}
            </section>

            <AnimatePresence initial={false}>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <ExplicitGatesChecklist gates={explicitGates} />

                <section className="review-section">
                  <h3>Final Confirmation</h3>
                  <p>{diff.confirmation?.label || "Type confirmation text to proceed."}</p>
                  <p className="confirmation-text">{diff.confirmation?.expectedValue || ""}</p>
                  <input
                    value={typedClientShortName}
                    onChange={(event) => onTypedClientShortNameChange(event.target.value)}
                    placeholder="Type exactly as shown"
                  />
                </section>
              </motion.div>
            </AnimatePresence>
          </>
        ) : null}

        <div className="modal-actions">
          <button className="secondary" onClick={onCancel} type="button" disabled={deploying}>
            Cancel
          </button>
          <button type="button" onClick={onDeploy} disabled={!canDeploy || deploying}>
            {deploying ? "Deploying..." : "Deploy with Confirmation"}
          </button>
        </div>
      </div>
    </div>
  );
}
