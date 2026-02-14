"use client";

import { FormEvent, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Sending login link...");

    try {
      const response = await fetch(`${API_BASE}/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const text = await response.text();
      setStatus(`Status ${response.status}: ${text || "No response body"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unknown error");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Admin Login</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter an authorized email address to receive a login link.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="you@example.com"
          />

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Send Login Link
          </button>
        </form>

        <div className="mt-4 min-h-[1.5rem] text-sm text-slate-700">
          {status}
        </div>
      </div>
    </main>
  );
}
