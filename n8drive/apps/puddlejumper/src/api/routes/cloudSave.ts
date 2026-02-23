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

export function createCloudSaveRoutes(opts: { store: ConnectorStore; fetchImpl?: typeof fetch }): express.Router {
  const router = express.Router();
  const fetchImpl = opts.fetchImpl ?? fetch;

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
        const result = await saveToGoogleDrive({ fetchImpl, accessToken: token.accessToken, filename, contentBase64, mimeType, folderId });
        res.json(result);
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
    const data = await updateRes.json() as { id?: string; webViewLink?: string };
    if (!updateRes.ok) throw new Error(`Google Drive update failed: ${JSON.stringify(data)}`);
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
  const uploadData = await uploadRes.json() as { id?: string; webViewLink?: string };
  if (!uploadRes.ok) throw new Error(`Google Drive upload failed: ${JSON.stringify(uploadData)}`);
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
