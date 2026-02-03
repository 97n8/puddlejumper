const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

export async function graphRequest(auth, path, { method = "GET", headers = {}, body = null, scopes = null } = {}) {
  const tokenResult = await auth.acquireToken(scopes || undefined);
  if (!tokenResult) return null; // redirecting

  const res = await fetch(`${GRAPH_ROOT}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${tokenResult.accessToken}`,
      "Accept": "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : null
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const msg = `Graph ${method} ${path} failed: ${res.status} ${res.statusText}${text ? `\n${text}` : ""}`;
    const err = new Error(msg);
    err.status = res.status;
    err.responseText = text;
    throw err;
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return await res.json();

  return await res.text();
}

export async function graphGet(auth, path) {
  return await graphRequest(auth, path, { method: "GET" });
}

export async function graphPost(auth, path, body) {
  return await graphRequest(auth, path, { method: "POST", body });
}

export async function graphPatch(auth, path, body) {
  return await graphRequest(auth, path, { method: "PATCH", body });
}
