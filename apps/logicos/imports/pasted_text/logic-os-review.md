Got it — that's the **logicOS frontend** (the React app). PuddleJumper and Logic Commons aren't in this paste or in the repo, so I can only review them through their *contract surface* — the endpoints and assumptions logicOS makes about them. I'll flag those at the end.

# logicOS — review

## Critical (will block production)

**1. Anthropic API call from the browser — won't work, and shouldn't.**
`AITool` and `QuickAIView` both `fetch('https://api.anthropic.com/v1/messages', ...)` with:
- no `x-api-key` header
- no `anthropic-version` header
- no `anthropic-dangerous-direct-browser-access: true`
- CORS is not enabled by Anthropic for normal browser origins.

Even if you fix the headers, putting the API key in a static frontend leaks it to every user. **Proxy this through PuddleJumper** (e.g. `POST {puddleJumper}/api/ai/messages`) and have the backend hold the key, enforce per-case rate limits, and log usage.

**2. `mode: 'no-cors'` everywhere produces opaque responses you can't trust.**
- VAULT intake: the `setInbox(next.map(... sentToVault: true))` runs as long as `fetch` doesn't throw, but a 500 response over `no-cors` does *not* throw. You'll mark items "✓ VAULT" that VAULT never accepted.
- The PuddleJumper liveness probe (`StatusBar`) has the same problem — opaque success on 5xx, only network failures throw. The "online" indicator is essentially "DNS resolves."

Switch to CORS-enabled endpoints and read `res.ok`. If that's not possible, at minimum keep a local "pending sync" queue and reconcile when PuddleJumper acks.

**3. Smart quotes everywhere.**
The paste is full of `'`/`'`/`"` — that file as-pasted will not parse. Whether that's a paste artifact or the source of truth, run it through a linter before assuming it builds.

**4. Captures use `'+'` for IDs (`'i'+Date.now()`).**
Two captures in the same millisecond collide. Use `crypto.randomUUID()`.

---

## Bugs / correctness

**`SwipeRow` races.** `onTouchEnd` schedules `setTimeout(() => onSwipeRight(), 180)` based on the `dx` *closed over at that moment*; if the component re-renders or the user starts a new gesture during those 180ms, you can fire the wrong callback or double-fire. Also the abort-style timeout in the PJ probe (`setTimeout(() => ctrl.abort(), 3000)`) is never cleared on success — those handles leak each cycle.

**`AITool` race.** `next.map(m => ({ role: m.role, content: m.content }))` is sent to Claude including the just-pushed user message, but on next render `setMessages(next)` may have already been replaced by a quick second send. Disable the input while `loading` (you do, good) but also guard against `caseData.id` changing mid-request — the response will be persisted under the *new* case key.

**`TimelineTool` invents timestamps.** `ts: Date.now() - 3600000` for completed tasks is a lie. Add a `completedAt` field to docket items when toggling done.

**Capture/inbox state thrash.** In `TodayView.capture` and `CaptureTool.send` you do `setInbox(next)` then later `setInbox(next.map(...))`. If the user adds another item between the two, you blow it away. Use the functional setter: `setInbox(prev => prev.map(i => i.id === item.id ? {...i, sentToVault: true} : i))`.

**`Store.set` on every keystroke.** `NotesTool` and `CodeTool` write the entire blob to localStorage on every change. Debounce (300–500ms). On long notes this is visible jank on low-end devices and consumes write budget on mobile Safari.

**localStorage quota.** Per-case AI history + notes + code + people, all serialized as JSON, will hit ~5MB fast for power users. Move durable case state to PuddleJumper; treat localStorage as a cache.

**Dead config.**
- `endpoints.policyAPI` is set in Settings but `PolicyTool` ignores it and uses a hardcoded `SEED` array.
- `endpoints.logicOS` and `endpoints.logicCommons` are saved but never read.
- `endpoints.aiEnabled` is toggled in Settings but `AITool`/`QuickAIView` never check it.
- `AI_INTEGRATIONS` (`claude`, `claude-h`, `web`) is stored per-case but `model` is hardcoded `claude-sonnet-4-20250514` regardless. The "Web Search" option does nothing.

**Missing referential integrity.** Captures and tasks reference `caseId`, but deleting a case in `CasesView` doesn't cascade — orphaned records remain and silently disappear from Today/Search filtering on case lookup.

**`new Function(code)` in `CodeTool`.** Currently safe (operator types it themselves), but the moment you sync code scratchpads from VAULT or share between devices, this becomes RCE. Sandbox in an iframe with `sandbox="allow-scripts"` and no parent access, or move execution server-side.

**Probe timer churn.** `useEffect` for PJ probe depends on `[endpoints.puddleJumper, loaded]`; saving Settings creates a new endpoints object, which may or may not change the URL but always retriggers. Compare URL string.

**Model ID.** `claude-sonnet-4-20250514` — given today is 2026-05-05, you're on the prior generation. Latest is `claude-sonnet-4-6` (or Opus 4.7 if you need the heavy reasoning). Move the model into `endpoints` so it's tunable without a redeploy.

---

## Accessibility

- **Custom checkboxes are `<div>`s.** Screen readers won't announce "checked." Use real `<input type="checkbox">` styled, or `role="checkbox" aria-checked={done}` plus keyboard handlers.
- **Swipe-to-complete has no keyboard equivalent.** Add long-press / context menu / explicit buttons.
- **Modal drawers** (`SettingsDrawer`, `CaseConfigDrawer`, `CommandPalette`) have no focus trap and don't restore focus to the trigger on close.
- **Status-bar 5G/battery icons** are decoration; mark `aria-hidden`.
- **Bottom nav** should be `role="tablist"` with `aria-selected`/`aria-current="page"` on the active tab.
- **`<select>` in Capture** has no `<label>`.
- **Color-only case identifier** (the colored stripe + dot). Add a visually-hidden text label.

---

## UX

- **Cmd-K palette has no mobile entrypoint** other than the masthead `K` chip — easy to miss on phones, which is the primary form factor (you literally render a phone bezel). Add a long-press on the floating AI button or a + FAB.
- **AI input is `<input>` not `<textarea>`** — can't paste multi-line prompts; Enter always sends. Use textarea + Cmd/Ctrl-Enter to send.
- **No streaming**, so responses feel slow. Use SSE through PuddleJumper.
- **`pb-safe`** isn't a default Tailwind class; either add it via plugin or use `env(safe-area-inset-bottom)` directly. Right now it's a no-op.
- **Floating AI button at `bottom-24 right-5`** overlaps the bottom nav on shorter viewports. Move it inside the device frame's safe area.
- **No empty-state recovery in Settings**: if the operator clears `vaultIntake`, captures silently fail with no message.
- **Captures show "✓ VAULT" / "⏳ Local"** but never "✗ Failed." When the queue grows, the operator can't tell the difference between in-flight and rejected.

---

## Architecture

- **One 1,300-line file** with ~20 components. Split: `app/` (root, routing), `views/`, `tools/`, `primitives/` (SwipeRow, Masthead), `lib/store.js`, `lib/api.js`, `seed/`. The case workspace alone justifies its own folder.
- **No TypeScript.** This app has a stable enough domain model (Case, Task, Capture, Endpoint) that types would catch the dead-config bugs above immediately.
- **Seeds in source.** `SEED_CASES`, `SEED_DOCKET`, the hardcoded `SEED` policy list — these belong behind a `/seed` endpoint or behind a "demo mode" flag, not in the production bundle.
- **No abstraction over fetch.** Every tool writes its own `fetch` with bespoke error handling. Centralize: `api.captureToVault(item)`, `api.askClaude(messages, system)`, `api.probe()`. Then the no-cors / auth / retry concerns live in one place.
- **No offline queue.** Captures that fail VAULT intake are stranded forever. You need a queue with retries, exponential backoff, and a UI affordance to inspect/retry.
- **No auth model.** Every capture sends `source: 'logicOS'` and nothing else. PuddleJumper has no way to attribute work to an operator. Add an auth bootstrap (token in `Store`, refreshed via PuddleJumper) before this leaves your machine.
- **Smart-sort is by `lastOpened`.** Fine for now, but `lastOpened` is updated only on explicit open from `Today`/`Cases` lists, not from palette opens or capture targeting. Inconsistent.

---

## What I can infer about PuddleJumper / Logic Commons (contract review only)

These aren't in the repo or in your paste, so I'm reviewing the *interface logicOS expects*:

**PuddleJumper contract surface as used by logicOS**
- `GET {puddleJumper}/` — used as a liveness probe via `fetch(..., {mode:'no-cors'})`. Expose a real `GET /healthz` returning `200 {status:"ok"}` with permissive CORS for the logicOS origin so the probe can read `res.ok`.
- `POST {puddleJumper}/api/vault/intake` — body `{source, id, ts, text, caseId, sentToVault}`. Three issues with this contract:
  1. `sentToVault: false` is sent *to* VAULT, which is meaningless — that's a client-side concern.
  2. No idempotency key — if the client retries on a flaky network, you'll get duplicates. Use the client `id` as an idempotency key and have PuddleJumper return 200 on a second submit.
  3. No auth, no operator identity, no case existence check.
- *Implied but missing:* `POST /api/ai/messages` (proxied Claude), `GET /api/cases`, `GET /api/docket`, `GET /api/policy?q=`. logicOS keeps everything in localStorage today; if PuddleJumper is the source of truth, these need to exist and logicOS needs to sync.

**Logic Commons contract surface as used by logicOS**
- The `logicCommons` endpoint is *configured but never called* by this code. Whatever Commons is supposed to be (template library? shared bylaws? reusable case scaffolds?), the frontend has zero integration with it. Either it's not built yet, or this app simply hasn't been wired to it. Decide: is Commons read-only library data the frontend pulls (`GET /commons/templates`)? Or is it backend-to-backend and never touches the operator? The current code implies the former but doesn't deliver.

If you can drop the PuddleJumper and Logic Commons sources (or push them to this branch), I'll do the same level of review on those.

---

## Highest-leverage fixes, in order

1. Move all Anthropic calls to a PuddleJumper proxy. Remove the model ID from the bundle.
2. Replace `mode: 'no-cors'` with real CORS + `res.ok` checks; build an offline retry queue for VAULT intake.
3. Fix the smart-quotes / make sure CI lints + builds the actual file you ship.
4. Wire the dead config (`policyAPI`, `aiEnabled`, per-case `ai` selection, `logicCommons`) or remove it from the UI.
5. Split the file and add TypeScript before the next feature lands.
6. Real checkbox semantics + focus traps for drawers.
7. Debounce localStorage writes and cap per-case history.

Want me to apply any of these? I can start with (1)–(4) on this branch.