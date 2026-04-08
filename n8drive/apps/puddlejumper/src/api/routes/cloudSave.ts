// ── Cloud Save ────────────────────────────────────────────────────────────────
//
// Generic "save file to cloud storage" endpoint used by LogicOS features
// (Pen, Docs, Files, etc.) to persist content to a connected provider.
//
// POST /api/cloud-save
// Body: {
//   provider: "google" | "microsoft" | "github"
//   filename: string           — e.g. "my-pen.html"
//   contentBase64: string      — base64-encoded file content
//   mimeType?: string          — defaults sensibly per provider
//   folderId?: string          — Google Drive folder ID or OneDrive folder path
//   githubRepo?: string        — "owner/repo" for GitHub
//   githubPath?: string        — path in repo, e.g. "logicpen/my-pen.html"
//   githubMessage?: string     — commit message
// }
// Returns: { fileId, url }

import express from "express";
import { getAuthContext } from "@publiclogic/core";
import type { ConnectorStore } from "../connectorStore.js";
import { z } from "zod";

// Refresh an expired Google OAuth token and persist the new one.
// Returns the new access token, or null if refresh failed.
async function refreshGoogleToken(
  store: ConnectorStore,
  fetchImpl: typeof fetch,
  tenantId: string,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) return null;
  try {
    const form = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
    const res = await fetchImpl("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
    if (!res.ok) return null;
    const payload = await res.json() as Record<string, unknown>;
    const accessToken = typeof payload.access_token === "string" ? payload.access_token : null;
    if (!accessToken) return null;
    const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
    store.upsertToken({ provider: "google", tenantId, userId, accessToken, refreshToken, scopes: [], account: null, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() });
    return accessToken;
  } catch {
    return null;
  }
}

const bodySchema = z.object({
  provider: z.enum(["google", "microsoft", "github"]),
  filename: z.string().trim().min(1).max(255),
  contentBase64: z.string().min(0),
  mimeType: z.string().optional(),
  // Google / OneDrive
  folderId: z.string().optional(),
  driveId: z.string().optional(),   // OneDrive/SharePoint drive ID
  // GitHub-specific
  githubRepo: z.string().optional(),
  githubPath: z.string().optional(),
  githubMessage: z.string().optional(),
});

// ── Google Drive folder path helper ──────────────────────────────────────────

async function ensureGoogleDriveFolderPath(
  fetchImpl: typeof fetch,
  accessToken: string,
  rootFolderId: string,
  pathSegments: string[],
  folderCache: Map<string, string>
): Promise<string> {
  let currentId = rootFolderId;
  for (const segment of pathSegments) {
    const cacheKey = `${currentId}/${segment}`;
    if (folderCache.has(cacheKey)) { currentId = folderCache.get(cacheKey)!; continue; }
    const q = `name = '${segment.replace(/'/g, "\\'")}' and '${currentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchRes = await fetchImpl(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchRes.json() as { files?: { id: string }[] };
    const existingId = searchData.files?.[0]?.id;
    if (existingId) { folderCache.set(cacheKey, existingId); currentId = existingId; continue; }
    const createRes = await fetchImpl("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: segment, mimeType: "application/vnd.google-apps.folder", parents: [currentId] }),
    });
    const created = await createRes.json() as { id?: string };
    const newId = created.id ?? currentId;
    folderCache.set(cacheKey, newId);
    currentId = newId;
  }
  return currentId;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const batchItemSchema = z.object({
  provider: z.enum(["google", "microsoft", "github"]),
  filename: z.string().trim().min(1).max(255),
  contentBase64: z.string(),
  mimeType: z.string().optional(),
  folderId: z.string().optional(),
  driveId: z.string().optional(),
  githubRepo: z.string().optional(),
  githubPath: z.string().optional(),
  githubMessage: z.string().optional(),
});

const batchBodySchema = z.object({
  items: z.array(batchItemSchema).min(1).max(500),
});

const importRepoBodySchema = z.object({
  owner: z.string().trim().min(1),
  repo: z.string().trim().min(1),
  branch: z.string().optional(),
  paths: z.array(z.string()).optional(),
  targetProvider: z.enum(["google", "microsoft", "github"]),
  targetFolderId: z.string().optional(),
  targetDriveId: z.string().optional(),
  targetRepo: z.string().optional(),
  targetBasePath: z.string().optional(),
  commitMessage: z.string().optional(),
});

export function createCloudSaveRoutes(opts: { store: ConnectorStore; fetchImpl?: typeof fetch }): express.Router {
  const router = express.Router();
  const fetchImpl = opts.fetchImpl ?? fetch;

  // ── POST /batch ──────────────────────────────────────────────────────────────

  router.post("/batch", async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    const tenantId = auth.tenantId ?? "";
    if (!tenantId) { res.status(400).json({ error: "Tenant scope unavailable" }); return; }

    const parsed = batchBodySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() }); return; }

    const { items } = parsed.data;
    const userId = auth.userId ?? auth.sub;

    // Concurrency-limited executor
    const results: Array<{ filename: string; path?: string; success: boolean; fileId?: string; url?: string; error?: string }> = [];
    const CONCURRENCY = 10;
    let idx = 0;

    async function processOne(item: typeof items[0]) {
      const token = opts.store.getToken(item.provider, tenantId, userId);
      if (!token) {
        results.push({ filename: item.filename, success: false, error: `${item.provider} not connected` });
        return;
      }
      try {
        if (item.provider === "google") {
          let accessToken = token.accessToken;
          try {
            const r = await saveToGoogleDrive({ fetchImpl, accessToken, filename: item.filename, contentBase64: item.contentBase64, mimeType: item.mimeType, folderId: item.folderId });
            results.push({ filename: item.filename, success: true, fileId: r.fileId, url: r.url });
          } catch (err) {
            const is401 = err instanceof Error && (
              (err as NodeJS.ErrnoException & { code?: number }).code === 401 ||
              err.message.includes('"code":401') || err.message.includes('"code": 401')
            );
            if (is401 && token.refreshToken) {
              const newToken = await refreshGoogleToken(opts.store, fetchImpl, tenantId, userId, token.refreshToken);
              if (newToken) {
                const r = await saveToGoogleDrive({ fetchImpl, accessToken: newToken, filename: item.filename, contentBase64: item.contentBase64, mimeType: item.mimeType, folderId: item.folderId });
                results.push({ filename: item.filename, success: true, fileId: r.fileId, url: r.url });
                return;
              }
            }
            throw err;
          }
        } else if (item.provider === "microsoft") {
          const r = await saveToOneDrive({ fetchImpl, accessToken: token.accessToken, filename: item.filename, contentBase64: item.contentBase64, mimeType: item.mimeType, folderId: item.folderId, driveId: item.driveId });
          results.push({ filename: item.filename, success: true, fileId: r.fileId, url: r.url });
        } else {
          if (!item.githubRepo) { results.push({ filename: item.filename, success: false, error: "githubRepo required" }); return; }
          const r = await saveToGitHub({ fetchImpl, accessToken: token.accessToken, repo: item.githubRepo, filename: item.filename, contentBase64: item.contentBase64, path: item.githubPath, message: item.githubMessage });
          results.push({ filename: item.filename, path: item.githubPath, success: true, fileId: r.fileId, url: r.url });
        }
      } catch (err) {
        results.push({ filename: item.filename, success: false, error: err instanceof Error ? err.message : "Save failed" });
      }
    }

    async function runBatch() {
      while (idx < items.length) {
        const batch = items.slice(idx, idx + CONCURRENCY);
        idx += CONCURRENCY;
        await Promise.all(batch.map(processOne));
      }
    }

    await runBatch();
    res.json({ results });
  });

  // ── POST /import-repo ────────────────────────────────────────────────────────

  router.post("/import-repo", async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    const tenantId = auth.tenantId ?? "";
    if (!tenantId) { res.status(400).json({ error: "Tenant scope unavailable" }); return; }

    const parsed = importRepoBodySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() }); return; }

    const { owner, repo, paths: pathFilter, targetProvider, targetFolderId, targetDriveId, targetRepo, targetBasePath, commitMessage } = parsed.data;
    let { branch } = parsed.data;
    const userId = auth.userId ?? auth.sub;

    const githubToken = opts.store.getToken("github", tenantId, userId);
    if (!githubToken) { res.status(401).json({ error: "GitHub not connected", code: "GITHUB_NOT_CONNECTED" }); return; }

    const targetToken = opts.store.getToken(targetProvider, tenantId, userId);
    if (!targetToken) { res.status(401).json({ error: `${targetProvider} not connected`, code: `${targetProvider.toUpperCase()}_NOT_CONNECTED` }); return; }

    const ghHeaders = {
      Authorization: `Bearer ${githubToken.accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "PublicLogic-LogicOS",
    };

    try {
      // 1. Get default branch if not provided
      if (!branch) {
        const repoRes = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders });
        if (!repoRes.ok) { res.status(502).json({ error: `Failed to fetch repo info: ${repoRes.status}` }); return; }
        const repoData = await repoRes.json() as { default_branch?: string };
        branch = repoData.default_branch ?? "main";
      }

      // 2. Get branch commit tree SHA
      const branchRes = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`, { headers: ghHeaders });
      if (!branchRes.ok) { res.status(502).json({ error: `Failed to fetch branch: ${branchRes.status}` }); return; }
      const branchData = await branchRes.json() as { commit?: { commit?: { tree?: { sha?: string } } } };
      const treeSha = branchData.commit?.commit?.tree?.sha;
      if (!treeSha) { res.status(502).json({ error: "Could not resolve tree SHA" }); return; }

      // 3. Fetch full recursive tree
      const treeRes = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, { headers: ghHeaders });
      if (!treeRes.ok) { res.status(502).json({ error: `Failed to fetch tree: ${treeRes.status}` }); return; }
      const treeData = await treeRes.json() as { tree?: Array<{ path?: string; type?: string; size?: number }> };

      // 4. Filter blobs, size limit, path filter, max 500
      let blobs = (treeData.tree ?? [])
        .filter(n => n.type === "blob" && (n.size ?? 0) <= 1_000_000 && n.path);

      if (pathFilter && pathFilter.length > 0) {
        blobs = blobs.filter(n => pathFilter.some(p => n.path!.startsWith(p)));
      }

      const skippedLarge = (treeData.tree ?? []).filter(n => n.type === "blob" && (n.size ?? 0) > 1_000_000).length;
      blobs = blobs.slice(0, 500);

      const basePath = targetBasePath ?? `${repo}`;
      const folderCache = new Map<string, string>();
      const manifest: Array<{ path: string; filename: string; success: boolean; url?: string; error?: string }> = [];

      // 5. Process in batches of 5
      const BATCH = 5;
      for (let i = 0; i < blobs.length; i += BATCH) {
        const chunk = blobs.slice(i, i + BATCH);
        await Promise.all(chunk.map(async (blob) => {
          const blobPath = blob.path!;
          const filename = blobPath.split("/").pop() ?? blobPath;
          try {
            // Fetch file content from GitHub
            const contentRes = await fetchImpl(
              `https://api.github.com/repos/${owner}/${repo}/contents/${blobPath}?ref=${branch}`,
              { headers: ghHeaders }
            );
            if (!contentRes.ok) {
              manifest.push({ path: blobPath, filename, success: false, error: `GitHub fetch failed: ${contentRes.status}` });
              return;
            }
            const contentData = await contentRes.json() as { content?: string };
            const contentBase64 = (contentData.content ?? "").replace(/\n/g, "");

            if (targetProvider === "google") {
              const segments = `${basePath}/${blobPath}`.split("/").slice(0, -1).filter(Boolean);
              const parentId = await ensureGoogleDriveFolderPath(fetchImpl, targetToken.accessToken, targetFolderId ?? "root", segments, folderCache);
              const r = await saveToGoogleDrive({ fetchImpl, accessToken: targetToken.accessToken, filename, contentBase64, folderId: parentId });
              manifest.push({ path: blobPath, filename, success: true, url: r.url });
            } else if (targetProvider === "microsoft") {
              const uploadPath = [basePath, blobPath].filter(Boolean).join("/");
              const encodedPath = uploadPath.split("/").map(encodeURIComponent).join("/");
              const uploadUrl = targetDriveId
                ? `https://graph.microsoft.com/v1.0/drives/${targetDriveId}/root:/${encodedPath}:/content`
                : `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/content`;
              const uploadRes = await fetchImpl(uploadUrl, {
                method: "PUT",
                headers: { Authorization: `Bearer ${targetToken.accessToken}`, "Content-Type": guessMime(filename) },
                body: Buffer.from(contentBase64, "base64"),
              });
              const uploadData = await uploadRes.json() as { id?: string; webUrl?: string; error?: unknown };
              if (!uploadRes.ok) throw new Error(`OneDrive upload failed: ${JSON.stringify(uploadData.error ?? uploadData)}`);
              manifest.push({ path: blobPath, filename, success: true, url: uploadData.webUrl ?? "" });
            } else {
              if (!targetRepo) { manifest.push({ path: blobPath, filename, success: false, error: "targetRepo required for GitHub target" }); return; }
              const targetPath = [basePath, blobPath].filter(Boolean).join("/");
              const r = await saveToGitHub({ fetchImpl, accessToken: targetToken.accessToken, repo: targetRepo, filename, contentBase64, path: targetPath, message: commitMessage ?? `Import ${blobPath} from ${owner}/${repo}` });
              manifest.push({ path: blobPath, filename, success: true, url: r.url });
            }
          } catch (err) {
            manifest.push({ path: blobPath, filename, success: false, error: err instanceof Error ? err.message : "Save failed" });
          }
        }));
        // Small delay between batches to respect rate limits
        if (i + BATCH < blobs.length) await new Promise(r => setTimeout(r, 200));
      }

      const succeeded = manifest.filter(m => m.success).length;
      const failed = manifest.filter(m => !m.success).length;
      res.json({ manifest, total: blobs.length, succeeded, failed, skipped: skippedLarge });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      res.status(502).json({ error: message });
    }
  });

  router.post("/", async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    const tenantId = auth.tenantId ?? "";
    if (!tenantId) { res.status(400).json({ error: "Tenant scope unavailable" }); return; }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", detail: parsed.error.flatten() });
      return;
    }
    const { provider, filename, contentBase64, mimeType, folderId, driveId, githubRepo, githubPath, githubMessage } = parsed.data;

    const token = opts.store.getToken(provider, tenantId, auth.userId ?? auth.sub);
    if (!token) {
      res.status(401).json({ error: `${provider} not connected`, code: `${provider.toUpperCase()}_NOT_CONNECTED` });
      return;
    }

    try {
      if (provider === "google") {
        let accessToken = token.accessToken;
        try {
          const result = await saveToGoogleDrive({ fetchImpl, accessToken, filename, contentBase64, mimeType, folderId });
          res.json(result); return;
        } catch (err) {
          const is401 = err instanceof Error && (
            (err as NodeJS.ErrnoException & { code?: number }).code === 401 ||
            err.message.includes('"code":401') || err.message.includes('"code": 401')
          );
          if (is401 && token.refreshToken) {
            const newToken = await refreshGoogleToken(opts.store, fetchImpl, tenantId, auth.userId ?? auth.sub, token.refreshToken);
            if (newToken) {
              const result = await saveToGoogleDrive({ fetchImpl, accessToken: newToken, filename, contentBase64, mimeType, folderId });
              res.json(result); return;
            }
          }
          throw err;
        }
      } else if (provider === "microsoft") {
        const result = await saveToOneDrive({ fetchImpl, accessToken: token.accessToken, filename, contentBase64, mimeType, folderId, driveId });
        res.json(result);
      } else {
        if (!githubRepo) { res.status(400).json({ error: "githubRepo is required for GitHub saves" }); return; }
        const result = await saveToGitHub({ fetchImpl, accessToken: token.accessToken, repo: githubRepo, filename, contentBase64, path: githubPath, message: githubMessage });
        res.json(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      res.status(502).json({ error: message });
    }
  });

  return router;
}

// ── Google Drive ─────────────────────────────────────────────────────────────

async function saveToGoogleDrive(opts: {
  fetchImpl: typeof fetch;
  accessToken: string;
  filename: string;
  contentBase64: string;
  mimeType?: string;
  folderId?: string;
}): Promise<{ fileId: string; url: string }> {
  const { fetchImpl, accessToken, filename, contentBase64, mimeType, folderId } = opts;
  const mime = mimeType ?? guessMime(filename);
  const content = Buffer.from(contentBase64, "base64");

  // Check if a file with this name already exists in the folder
  const parentId = folderId ?? "root";
  const searchQ = `name = '${filename.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed = false`;
  const searchRes = await fetchImpl(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQ)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!searchRes.ok) {
    const errBody = await searchRes.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Google Drive search failed: ${JSON.stringify(errBody)}`);
  }
  const searchData = await searchRes.json() as { files?: { id: string }[] };
  const existingId = searchData.files?.[0]?.id;

  if (existingId) {
    // Update existing file content
    const updateRes = await fetchImpl(
      `https://upload.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media&fields=id,webViewLink`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": mime },
        body: content,
      }
    );
    if (!updateRes.ok) {
      if (updateRes.status === 401) throw Object.assign(new Error("Google Drive token expired"), { code: 401 });
      const errBody = await updateRes.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(`Google Drive update failed (${updateRes.status}): ${JSON.stringify(errBody)}`);
    }
    const data = await updateRes.json() as { id?: string; webViewLink?: string };
    return { fileId: data.id ?? existingId, url: data.webViewLink ?? `https://drive.google.com/file/d/${existingId}/view` };
  }

  // Multipart upload to create new file
  const metadata = JSON.stringify({ name: filename, parents: [parentId] });
  const boundary = "logicos_boundary_" + Math.random().toString(36).slice(2);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const uploadRes = await fetchImpl(
    "https://upload.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  if (!uploadRes.ok) {
    if (uploadRes.status === 401) throw Object.assign(new Error("Google Drive token expired"), { code: 401 });
    const errBody = await uploadRes.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Google Drive upload failed (${uploadRes.status}): ${JSON.stringify(errBody)}`);
  }
  const uploadData = await uploadRes.json() as { id?: string; webViewLink?: string };
  return {
    fileId: uploadData.id ?? "",
    url: uploadData.webViewLink ?? `https://drive.google.com/file/d/${uploadData.id}/view`,
  };
}

// ── OneDrive ──────────────────────────────────────────────────────────────────

async function saveToOneDrive(opts: {
  fetchImpl: typeof fetch;
  accessToken: string;
  filename: string;
  contentBase64: string;
  mimeType?: string;
  folderId?: string;
  driveId?: string;
}): Promise<{ fileId: string; url: string }> {
  const { fetchImpl, accessToken, filename, contentBase64, folderId, driveId } = opts;
  const content = Buffer.from(contentBase64, "base64");

  // Use drive-specific URL when driveId is provided (e.g. SharePoint)
  let uploadUrl: string;
  if (driveId && folderId) {
    uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}:/${encodeURIComponent(filename)}:/content`;
  } else if (driveId) {
    uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodeURIComponent(filename)}:/content`;
  } else if (folderId) {
    uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${encodeURIComponent(filename)}:/content`;
  } else {
    uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(filename)}:/content`;
  }

  const uploadRes = await fetchImpl(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": opts.mimeType ?? guessMime(filename),
    },
    body: content,
  });

  const data = await uploadRes.json() as { id?: string; webUrl?: string; error?: unknown };
  if (!uploadRes.ok) throw new Error(`OneDrive upload failed: ${JSON.stringify(data.error ?? data)}`);
  return { fileId: data.id ?? "", url: data.webUrl ?? "" };
}

// ── GitHub ────────────────────────────────────────────────────────────────────

async function saveToGitHub(opts: {
  fetchImpl: typeof fetch;
  accessToken: string;
  repo: string;
  filename: string;
  contentBase64: string;
  path?: string;
  message?: string;
}): Promise<{ fileId: string; url: string }> {
  const { fetchImpl, accessToken, repo, filename, contentBase64, path, message } = opts;
  const filePath = path ?? `logicpen/${filename}`;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  // Check if file exists to get its SHA (required for updates)
  let sha: string | undefined;
  const checkRes = await fetchImpl(apiUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "User-Agent": "PublicLogic-LogicOS" },
  });
  if (checkRes.ok) {
    const existing = await checkRes.json() as { sha?: string };
    sha = existing.sha;
  }

  const commitMessage = message ?? (sha ? `Update ${filename} from LogicOS` : `Add ${filename} from LogicOS`);
  const body: Record<string, unknown> = { message: commitMessage, content: contentBase64 };
  if (sha) body.sha = sha;

  const putRes = await fetchImpl(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "PublicLogic-LogicOS",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await putRes.json() as { content?: { html_url?: string; sha?: string }; error?: string; message?: string };
  if (!putRes.ok) throw new Error(`GitHub save failed: ${data.message ?? data.error ?? "Unknown error"}`);
  return { fileId: data.content?.sha ?? filePath, url: data.content?.html_url ?? "" };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "application/javascript",
    ts: "text/plain",
    json: "application/json",
    md: "text/markdown",
    txt: "text/plain",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  return map[ext] ?? "application/octet-stream";
}
