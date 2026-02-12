import { ShieldCheck } from "lucide-react";

const ENVIRONMENT_OPTIONS = [
  { value: "", label: "Select environment" },
  { value: "sandbox", label: "Sandbox" },
  { value: "pilot", label: "Pilot" },
  { value: "production", label: "Production" }
];

function Checkbox({ checked, onChange, label, disabled }) {
  return (
    <label className="checkbox-row">
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

export default function DeploymentContext({
  context,
  onFieldChange,
  onModuleToggle,
  onSave,
  saving,
  saveMessage,
  validationErrors,
  jurisdictionLabel,
  derivedAuthorityGroups,
  authoritySyncDate,
  disabled
}) {
  const groups = Array.isArray(derivedAuthorityGroups)
    ? derivedAuthorityGroups.filter((value) => String(value || "").trim())
    : [];

  return (
    <section className="context-section">
      <h2>Deployment Context Details</h2>
      <p className="subtle">
        Capture the municipal context before review so permissions, guardrails, and audit records stay defensible.
      </p>

      <div className="context-grid">
        <label>
          Client Short Name
          <input
            value={context.clientShortName}
            onChange={(event) => onFieldChange("clientShortName", event.target.value)}
            placeholder="sutton-ma"
            disabled={disabled}
          />
        </label>

        <label>
          Client Formal Name
          <input
            value={context.clientFormalName}
            onChange={(event) => onFieldChange("clientFormalName", event.target.value)}
            placeholder="Town of Sutton"
            disabled={disabled}
          />
        </label>

        <label>
          Environment Type
          <select
            value={context.environmentType}
            onChange={(event) => onFieldChange("environmentType", event.target.value)}
            disabled={disabled}
          >
            {ENVIRONMENT_OPTIONS.map((option) => (
              <option key={option.value || "empty"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Microsoft Tenant ID
          <input
            value={context.microsoftTenantId}
            onChange={(event) => onFieldChange("microsoftTenantId", event.target.value)}
            placeholder="publiclogic.sharepoint.com"
            disabled={disabled}
          />
        </label>
      </div>

      <h3>Primary Municipal Contact</h3>
      <div className="context-grid">
        <label>
          Name
          <input
            value={context.primaryMunicipalContact.name}
            onChange={(event) => onFieldChange("primaryMunicipalContact.name", event.target.value)}
            placeholder="Jane Clerk"
            disabled={disabled}
          />
        </label>
        <label>
          Email
          <input
            value={context.primaryMunicipalContact.email}
            onChange={(event) => onFieldChange("primaryMunicipalContact.email", event.target.value)}
            placeholder="jane.clerk@town.gov"
            disabled={disabled}
          />
        </label>
      </div>

      <h3>Authority Mapping</h3>
      <div className="context-grid">
        <label>
          Authority Group
          <input
            value={context.authorityMapping.authorityGroup}
            onChange={(event) => onFieldChange("authorityMapping.authorityGroup", event.target.value)}
            placeholder="Town-Administrators"
            disabled={disabled}
          />
        </label>
        <label>
          Operators Group
          <input
            value={context.authorityMapping.operatorsGroup}
            onChange={(event) => onFieldChange("authorityMapping.operatorsGroup", event.target.value)}
            placeholder="Dept-Heads"
            disabled={disabled}
          />
        </label>
        <label>
          Read-Only Group
          <input
            value={context.authorityMapping.readOnlyGroup}
            onChange={(event) => onFieldChange("authorityMapping.readOnlyGroup", event.target.value)}
            placeholder="Town-Viewers"
            disabled={disabled}
          />
        </label>
      </div>
      <div className="derived-authority-card" aria-live="polite">
        <div className="derived-authority-head">
          <ShieldCheck size={16} />
          <p>Derived Authority</p>
        </div>
        <p className="subtle">
          You are authorized to act under {jurisdictionLabel || "selected jurisdiction"} via
          membership in {groups.length > 0 ? groups.join(", ") : "pending authority groups"}. Derived
          from Microsoft 365 directory sync on {authoritySyncDate || "today"}.
        </p>
        {groups.length > 1 ? (
          <ul className="derived-authority-list">
            {groups.map((group) => (
              <li key={group}>{group}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <h3>Optional Modules</h3>
      <div className="module-grid">
        <Checkbox
          checked={context.optionalModules.permittingWorkspace}
          onChange={() => onModuleToggle("permittingWorkspace")}
          label="Permitting Workspace"
          disabled={disabled}
        />
        <Checkbox
          checked={context.optionalModules.publicRecordsWorkspace}
          onChange={() => onModuleToggle("publicRecordsWorkspace")}
          label="Public Records Workspace"
          disabled={disabled}
        />
        <Checkbox
          checked={context.optionalModules.boardComplianceWorkspace}
          onChange={() => onModuleToggle("boardComplianceWorkspace")}
          label="Board Compliance Workspace"
          disabled={disabled}
        />
        <Checkbox
          checked={context.optionalModules.appointmentsWorkspace}
          onChange={() => onModuleToggle("appointmentsWorkspace")}
          label="Appointments Workspace"
          disabled={disabled}
        />
      </div>
      <p className="subtle">
        Optional modules add structure and templates only. They do not execute policy logic by themselves.
      </p>

      {validationErrors.length > 0 ? (
        <div className="inline-errors">
          {validationErrors.map((error) => (
            <p key={error} className="error">
              {error}
            </p>
          ))}
        </div>
      ) : null}

      <div className="context-actions">
        <button type="button" onClick={onSave} disabled={saving || disabled}>
          {saving ? "Saving Context..." : "Save Context"}
        </button>
        {saveMessage ? <p className="notice compact">{saveMessage}</p> : null}
      </div>
    </section>
  );
}
