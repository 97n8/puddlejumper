import bcrypt from "bcrypt";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { config, ensureRuntimePaths } from "../src/config.js";
import { readUsers, writeUsers } from "../src/users.js";

function parseUsernameArg() {
  const username = process.argv[2];
  if (!username) {
    throw new Error("Usage: npm run create-admin <username>");
  }
  return username.trim();
}

function promptHidden(promptText) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let buffer = "";

    process.stdout.write(promptText);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);

    function onData(char) {
      if (char === "\u0003") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        process.exit(1);
      }

      if (char === "\r" || char === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(buffer);
        return;
      }

      if (char === "\u007f") {
        buffer = buffer.slice(0, -1);
        return;
      }

      buffer += char;
    }

    stdin.on("data", onData);
  });
}

async function collectPasswordInputs() {
  if (!process.stdin.isTTY) {
    process.stdout.write("Enter password: \n");
    process.stdout.write("Confirm password: \n");
    const raw = fsSync.readFileSync(0, "utf8");
    const [password = "", confirmPassword = ""] = raw.split(/\r?\n/);
    return { password, confirmPassword };
  }

  const password = await promptHidden("Enter password: ");
  const confirmPassword = await promptHidden("Confirm password: ");
  return { password, confirmPassword };
}

async function createAdmin() {
  const username = parseUsernameArg();
  if (!username) {
    throw new Error("Username cannot be empty.");
  }

  await ensureRuntimePaths();
  await fs.mkdir(path.dirname(config.usersFilePath), { recursive: true });

  const { password, confirmPassword } = await collectPasswordInputs();

  if (password.length < 10) {
    throw new Error("Password must be at least 10 characters.");
  }

  if (password !== confirmPassword) {
    throw new Error("Passwords did not match.");
  }

  const usersPayload = await readUsers(config.usersFilePath);
  const nextUsers = usersPayload.users.filter((user) => user.username !== username);
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();

  nextUsers.push({
    username,
    passwordHash,
    role: "operator",
    updatedAt: now
  });

  await writeUsers(config.usersFilePath, { users: nextUsers });

  process.stdout.write(
    `Operator '${username}' has been saved in ${config.usersFilePath}\n`
  );
}

createAdmin().catch((error) => {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${reason}\n`);
  process.exit(1);
});
