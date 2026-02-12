export default function RecoveryCard({ recovery, onAction, onDismiss }) {
  if (!recovery) {
    return null;
  }

  const actions = Array.isArray(recovery.nextActions) ? recovery.nextActions : [];

  return (
    <section className="recovery-card" role="alert" aria-live="polite">
      <h3>{recovery.title || "What happened"}</h3>
      <p>{recovery.summary || "Something unexpected happened."}</p>
      {recovery.details ? <pre>{recovery.details}</pre> : null}

      <div className="recovery-actions">
        <span className="subtle">What to do next:</span>
        {actions.map((action) => (
          <button
            key={`${action.id || action.label}-${action.label}`}
            type="button"
            className="secondary"
            onClick={() => onAction?.(action)}
          >
            {action.label || "Action"}
          </button>
        ))}
        <button type="button" className="secondary" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </section>
  );
}
