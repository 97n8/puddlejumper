function MemoryPrompt({
  prompt,
  notes,
  onNotesChange,
  onSave,
  onSkip,
  saving
}) {
  if (!prompt?.show) {
    return null;
  }

  return (
    <section className="memory-prompt">
      <h3>Deployment Complete</h3>
      <p className="subtle">
        Leave notes for the next Operator. This replaces sticky notes, side chats, and memory gaps.
      </p>
      <p>
        Client: <strong>{prompt.client}</strong> | Environment: <strong>{prompt.environment}</strong>
      </p>
      {prompt.reason ? (
        <p>
          Deploy reason: <strong>{prompt.reason}</strong>
        </p>
      ) : null}
      <textarea
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
        placeholder={
          "Examples:\n- Non-standard permission map approved by counsel\n- Training moved to 2026-03-01 due to weather closure"
        }
      />
      <div className="inline-row">
        <button type="button" onClick={onSave} disabled={saving || !notes.trim()}>
          {saving ? "Saving Notes..." : "Save Memory Note"}
        </button>
        <button className="secondary" type="button" onClick={onSkip} disabled={saving}>
          Skip for Now
        </button>
      </div>
    </section>
  );
}

export default function VeritasMemory({
  prompt,
  notes,
  onNotesChange,
  onSave,
  onSkip,
  saving,
  entries,
  search,
  onSearchChange,
  onRefresh,
  exportCsvHref,
  exportJsonHref
}) {
  return (
    <section className="memory-section">
      <h2>Step 5: Veritas Memory</h2>
      <p className="subtle">
        Search prior notes by client, operator, and timeline to preserve institutional continuity.
      </p>

      <MemoryPrompt
        prompt={prompt}
        notes={notes}
        onNotesChange={onNotesChange}
        onSave={onSave}
        onSkip={onSkip}
        saving={saving}
      />

      <div className="memory-toolbar">
        <label>
          Search
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="client short name, operator, or note text"
          />
        </label>
        <div className="inline-row">
          <button className="secondary" type="button" onClick={onRefresh}>
            Refresh
          </button>
          <a href={exportCsvHref}>Export CSV</a>
          <a href={exportJsonHref}>Export JSON</a>
        </div>
      </div>

      <div className="memory-table-wrap">
        <table className="memory-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Client</th>
              <th>Environment</th>
              <th>Reason</th>
              <th>Operator</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6}>No memory notes found for this search.</td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.timestamp).toLocaleString()}</td>
                  <td>{entry.client || "n/a"}</td>
                  <td>{entry.environment || "n/a"}</td>
                  <td>{entry.reason || "n/a"}</td>
                  <td>{entry.operator || "n/a"}</td>
                  <td>{entry.notes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
