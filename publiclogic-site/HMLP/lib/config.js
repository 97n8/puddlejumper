export function getConfig() {
  // eslint-disable-next-line no-undef
  return window.PUBLICLOGIC_OS_CONFIG || null;
}

export function validateConfig(cfg) {
  const errors = [];
  if (!cfg) {
    errors.push("Missing config.js (window.PUBLICLOGIC_OS_CONFIG is null). Copy config.example.js -> config.js and fill values.");
    return errors;
  }

  if (!cfg.msal?.clientId || cfg.msal.clientId.includes("00000000")) errors.push("msal.clientId is missing");
  if (!cfg.msal?.tenantId || cfg.msal.tenantId.includes("00000000")) errors.push("msal.tenantId is missing");
  if (!cfg.msal?.redirectUri) errors.push("msal.redirectUri is missing");
  if (!Array.isArray(cfg.access?.allowedEmails) || cfg.access.allowedEmails.length === 0) {
    errors.push("access.allowedEmails must include you + Allie (keeps OS private)");
  }
  if (!Array.isArray(cfg.graph?.scopes) || cfg.graph.scopes.length === 0) errors.push("graph.scopes is missing");
  if (!cfg.sharepoint?.hostname) errors.push("sharepoint.hostname is missing");
  if (!cfg.sharepoint?.sitePath) errors.push("sharepoint.sitePath is missing");
  if (!cfg.sharepoint?.lists?.tasks) errors.push("sharepoint.lists.tasks is missing");
  if (!cfg.sharepoint?.lists?.pipeline) errors.push("sharepoint.lists.pipeline is missing");
  if (!cfg.sharepoint?.lists?.projects) errors.push("sharepoint.lists.projects is missing");

  return errors;
}
