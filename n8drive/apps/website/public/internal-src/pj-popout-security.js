function parseHostname(value) {
  try {
    return new URL(value).hostname.trim().toLowerCase();
  } catch {
    const candidate = String(value ?? "").trim().toLowerCase();
    if (!candidate || /[:/]/.test(candidate)) {
      return "";
    }
    return candidate;
  }
}

export function isTrustedOriginFromList(origin, allowedOrigins) {
  if (!origin || !Array.isArray(allowedOrigins)) {
    return false;
  }

  const originHostname = parseHostname(origin);
  if (!originHostname) {
    return false;
  }

  return allowedOrigins.some((allowed) => {
    if (!allowed || typeof allowed !== "string") {
      return false;
    }

    const trimmedAllowed = allowed.trim().toLowerCase();
    if (!trimmedAllowed) {
      return false;
    }

    if (trimmedAllowed.startsWith("*.")) {
      const baseDomain = trimmedAllowed.slice(2);
      if (!baseDomain) {
        return false;
      }
      return originHostname === baseDomain || originHostname.endsWith(`.${baseDomain}`);
    }

    const allowedHostname = parseHostname(trimmedAllowed);
    if (!allowedHostname) {
      return false;
    }

    if (allowedHostname === originHostname) {
      return true;
    }

    return false;
  });
}

export function applyIdentityContext(current, incoming) {
  const name = typeof incoming?.name === "string" && incoming.name.trim() ? incoming.name.trim() : current.name;
  const role = typeof incoming?.role === "string" && incoming.role.trim() ? incoming.role.trim() : current.role;
  const tenants = Array.isArray(incoming?.tenants) && incoming.tenants.length > 0 ? incoming.tenants : current.tenants;
  const trustedParentOrigins = Array.isArray(incoming?.trustedParentOrigins)
    ? incoming.trustedParentOrigins.filter((value) => typeof value === "string" && value.trim())
    : current.trustedParentOrigins;

  return {
    name,
    role,
    tenants,
    trustedParentOrigins
  };
}
