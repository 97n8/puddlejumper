import fs from "node:fs/promises";
import path from "node:path";

function normalizeUsersPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { users: [] };
  }

  if (Array.isArray(payload)) {
    return { users: payload };
  }

  if (!Array.isArray(payload.users)) {
    return { users: [] };
  }

  return { users: payload.users };
}

export async function readUsers(usersFilePath) {
  try {
    const raw = await fs.readFile(usersFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeUsersPayload(parsed);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { users: [] };
    }
    throw error;
  }
}

export async function writeUsers(usersFilePath, usersPayload) {
  const normalized = normalizeUsersPayload(usersPayload);
  await fs.mkdir(path.dirname(usersFilePath), { recursive: true });
  await fs.writeFile(usersFilePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

export async function findUserByUsername(usersFilePath, username) {
  const data = await readUsers(usersFilePath);
  return data.users.find((user) => user.username === username) || null;
}

export async function upsertOperator(usersFilePath, username, passwordHash) {
  const data = await readUsers(usersFilePath);
  const now = new Date().toISOString();

  const nextUsers = data.users.filter((user) => user.username !== username);
  nextUsers.push({
    username,
    passwordHash,
    role: "operator",
    updatedAt: now
  });

  await writeUsers(usersFilePath, { users: nextUsers });
}

export async function assertAtLeastOneOperator(usersFilePath) {
  const data = await readUsers(usersFilePath);
  const operatorCount = data.users.filter((user) => user.role === "operator").length;

  if (operatorCount < 1) {
    throw new Error(
      "No operator account found. Run 'npm run create-admin <username>' before starting the app."
    );
  }
}
