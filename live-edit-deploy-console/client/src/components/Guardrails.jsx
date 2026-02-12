function GuardrailChecklist({ guardrail, acknowledgments, onToggle }) {
  const ackState = acknowledgments[guardrail.id] || {};

  return (
    <div className="guardrail-checklist">
      {guardrail.checklist.map((item) => (
        <label key={`${guardrail.id}-${item.id}`} className="checkbox-row">
          <input
            type="checkbox"
            checked={ackState[item.id] === true}
            onChange={(event) => onToggle(guardrail.id, item.id, event.target.checked)}
          />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
}

function GuardrailDetails({ guardrail }) {
  if (guardrail.id === "metadata-overwrites") {
    return (
      <div className="guardrail-details">
        <p>Conflicting fields:</p>
        <ul>
          {(guardrail.conflicts || []).map((conflict) => (
            <li key={conflict.field}>
              {conflict.field}: current type {conflict.currentType}, canonical type {conflict.canonicalType}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (guardrail.id === "non-standard-permission-graph") {
    return (
      <div className="guardrail-details">
        <p>
          <strong>Standard:</strong> {guardrail.details?.expected}
        </p>
        <p>
          <strong>Your config:</strong>{" "}
          {guardrail.details?.configured
            ? `${guardrail.details.configured.authorityGroup || "n/a"} / ${
                guardrail.details.configured.operatorsGroup || "n/a"
              } / ${guardrail.details.configured.readOnlyGroup || "n/a"}`
            : "n/a"}
        </p>
        {guardrail.details?.reasons?.length ? (
          <>
            <p>Why this triggered:</p>
            <ul>
              {guardrail.details.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    );
  }

  if (guardrail.id === "emergency-compressed-review") {
    return (
      <div className="guardrail-details">
        <p>
          <strong>Incident:</strong> {guardrail.details?.incidentId || "n/a"}
        </p>
        <p>
          <strong>Declared by:</strong> {guardrail.details?.declaredBy || "n/a"}
        </p>
        <p>
          <strong>Post-action review due:</strong> {guardrail.details?.postActionReviewDueAt || "n/a"}
        </p>
      </div>
    );
  }

  return null;
}

export default function Guardrails({ guardrails, acknowledgments, onToggle }) {
  if (!guardrails?.length) {
    return (
      <section className="review-section">
        <h3>Guardrails</h3>
        <p className="success-text">
          No additional guardrail confirmations are required for this deployment.
        </p>
      </section>
    );
  }

  return (
    <section className="review-section">
      <h3>Judgment-Encoded Guardrails</h3>
      <p className="subtle">
        These checks are enforced server-side. Deployment cannot continue until each required confirmation is checked.
      </p>
      <div className="guardrail-list">
        {guardrails.map((guardrail) => (
          <article
            key={guardrail.id}
            className={`guardrail-item ${
              guardrail.severity === "critical" ? "guardrail-critical" : "guardrail-warning"
            }`}
          >
            <h4>{guardrail.title}</h4>
            <p>{guardrail.message}</p>
            <GuardrailDetails guardrail={guardrail} />
            <GuardrailChecklist
              guardrail={guardrail}
              acknowledgments={acknowledgments}
              onToggle={onToggle}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
