# Dashboard Data Consistency — Technical Design

## Overview

This design fixes seven data consistency and UX issues: (1) primary not applying relayed updates so session is lost after browser close when secondary was active, (2) activeTabId pointing to missing tabs, (3) no refresh/reload path, (4) real-time/slowness clarity, (5) single source of truth for state, (6) explicit failure/stale feedback in UI, (7) same as 1/5. The main technical changes are: primary applies relay messages to its own state and persists; manifest repair and activeTabId normalization in loadState and buildFullDump; client-side activeTabId validation; and UI copy and optional controls for failure/stale and last-update.

## Components / Modules Changed

- **`src/mcp/state.ts`** — Repair manifest when a change file is missing in `loadState`; optionally expose a pure “read manifest + change files” helper used by server for connect-time reload.
- **`src/mcp/server.ts`** — On relay: apply each relayed message to primary’s `changeStates` (and persist). Build full dump with normalized `activeTabId`. Optionally re-load from disk on browser connect. Add optional “waiting for client” or last-update metadata if protocol extended.
- **`src/mcp/ui/src/context/DashboardContext.tsx`** — On `SET_FULL_STATE`, normalize `activeTabId` when it is not in `tabs`. Optional: request full state on mount/reconnect (if server supports request).
- **`src/mcp/ui/src/App.tsx`** (or a small banner component) — Show “Session could not be loaded” / “Data may be outdated” when appropriate; optional “Reload session” button that triggers re-request of full state (if supported).
- **`src/mcp/ui`** — Optional: “Last update: …” or connection/sync indicator (e.g. in ReconnectBanner or header).

---

## Fix 1 & 5 & 7: Primary applies relayed updates (single source of truth)

**Problem:** Secondary sends relay messages; primary only broadcasts. Primary’s in-memory state is stale, so reconnecting clients get an outdated full dump.

**Approach:** When the primary receives a relay message, apply the same update to its own `changeStates` (and persist) before or after broadcasting. Treat relay payloads as the same shape as normal broadcast messages (`phase_update`, `tasks_update`, `event`, `change_context`, `qa_update`, `test_summary_update`, `questions`, `gate_request`, `tab_closed`).

**Design:**

- In `handleInternalConnection`, when `msg.type === "relay"` and `msg.payload` exists:
  - Parse `msg.payload` and switch on `payload.type`.
  - For each type, apply the update to primary’s `changeStates` and `activeChangeId` as if the tool had run on the primary (e.g. for `phase_update`: get or create change by `changeId`, set phases/currentPhase/classification/changeName/confidence, then `persistChange(changeId)`).
  - Then call `broadcast(msg.payload)` so existing clients still get the incremental update.
- Implement apply functions (e.g. `applyPhaseUpdate(changeId, payload)`, `applyTasksUpdate(changeId, payload)`, …) that update `changeStates` and call `persistChange`. Call these from the relay handler and keep existing tool handlers unchanged (they already mutate and broadcast).
- **Edge cases:** For `tab_closed`, primary must also call `deleteChangeState` and remove from `changeStates`; update `activeChangeId` if it was the closed tab. For `change_context`, create or update change and set `activeChangeId`. For `questions` / `gate_request`, create or update `pendingQuestion` / `pendingGate` on the change state (stale: false when coming from relay, since it’s from current session). For `gate_request`, also set phase `gateStatus` to `"pending"` if present.
- **Idempotency:** Applying the same relay twice should be safe (e.g. overwrite phases/tasks; append event once if we add idempotency keys later, or rely on “same message once” for now).

**Outcome:** Primary’s full dump always reflects the latest updates from either process; session survives browser close regardless of which process drove the workflow.

---

## Fix 2: activeTabId never points to a missing tab

**Problem:** `loadState` skips missing/corrupt change files but does not update the manifest; `buildFullDump()` can send `activeTabId` that is not in `tabs`.

**Approach:** (A) Repair manifest in `loadState` so `activeTabId` and `changeIds` only reference changes that were actually loaded. (B) In `buildFullDump()`, normalize `activeTabId` to the first available tab or null if the current `activeChangeId` is not in `changeStates`.

**Design:**

- **state.ts — loadState**
  - After loading each change file, build the set of successfully loaded change IDs.
  - Build a new manifest: `changeIds = loadedIds`, `activeTabId = manifest.activeTabId` only if `manifest.activeTabId` is in `loadedIds`, else `loadedIds[0] ?? null`.
  - Write the manifest back (via existing `writeManifest` or a new `repairManifest(projectPath, loadedIds, preferredActiveId)`) so that future loads and other callers see a consistent manifest.
- **server.ts — buildFullDump**
  - Set `activeTabId = activeChangeId != null && changeStates.has(activeChangeId) ? activeChangeId : (first key in changeStates or null)`. So even if in-memory `activeChangeId` was set from an old manifest before repair, we never send an invalid activeTabId.
- **UI — SET_FULL_STATE**
  - In the reducer, when applying `SET_FULL_STATE`, if `action.activeTabId` is not in `action.tabs`, set `activeTabId` to `Object.keys(action.tabs)[0] ?? null`. This defends against any older server or race.

**Outcome:** Server and client never show an active tab that doesn’t exist; no blank “waiting” state due to missing tab.

---

## Fix 3: Re-load from disk on browser connect (optional)

**Problem:** Reconnecting client only gets in-memory full dump; if primary had restarted and disk was written by a secondary after that, primary could still be stale.

**Approach (optional):** When a browser WebSocket connects (not internal relay), optionally re-load state from disk and then send the full dump. This makes “reconnect” always reflect the latest on disk. Trade-off: extra disk reads and possible brief inconsistency if a tool is writing at the same time. Recommendation: implement Fix 1 (primary applies relay) first; then add this as an option (e.g. env flag or always) so that even after primary restart, the first client to connect gets disk state.

**Design:**

- In `wss.on("connection")` for browser clients (the existing path that sends `buildFullDump()`), before building the dump:
  - Call `loadState(projectPath)` (or a variant that only reads from disk and returns changeStates + activeTabId).
  - Replace `changeStates` and `activeChangeId` with the loaded values (merge or replace: replace is simpler and matches “disk is truth on connect”).
  - Then call `buildFullDump()` and send.
- Ensure this runs only for browser connections, not for internal relay connections. Only the primary has browser connections; secondaries don’t run HTTP server.
- If “reload on connect” is always on, then after a primary restart, the first connect gets disk state; any subsequent relay will update primary again. If we only do “primary applies relay” and don’t reload on connect, then after primary restart we rely on disk having been written by primary before restart (secondaries write disk too), so next connect still gets that state from primary’s startup load. So “reload on connect” is mainly for the case where primary restarts and no tool has run yet but disk was updated by another process (e.g. manual edit or a secondary that wrote before primary restarted). For simplicity, the minimal fix is Fix 1 + Fix 2; document “reload on connect” as an optional follow-up.

**Outcome:** Optional; if implemented, first client connect after any restart sees latest disk state.

---

## Fix 4: Real-time / slowness clarity

**Problem:** Users don’t know if the server is waiting for a client or if data is current; background tabs feel slow.

**Approach:** (A) Surface “waiting for dashboard” only when feasible without new blocking protocol (e.g. do not change MCP tool behavior). (B) Add a “last update” indicator in the UI (timestamp or “just now”) so users can see when data was last updated.

**Design:**

- **Server waiting for client:** Currently `waitForBroadcast` polls until a client receives. We could add a lightweight way for the server to signal “waiting” (e.g. a separate one-way message or a field on the next state message). Out of scope for minimal fix: no new server-side “waiting” push. Document as future improvement.
- **Last update time:** Server includes an optional `lastUpdate` (ISO string or number) in the `state` message, set when any mutation is applied (primary or via relay). UI shows “Last update: &lt;relative time&gt;” in the header or ReconnectBanner. When the tab is in background, when the user comes back they see the last update time and can tell if it’s old.
- **Protocol:** Extend server `state` message with `lastUpdate?: string`. Set it in `buildFullDump()` from a module-level `lastUpdateTime` that is updated on every `persistChange` or on every broadcast of an update. Client stores and displays it.

**Outcome:** Users see when the dashboard was last updated; optional future: “waiting for client” indicator.

---

## Fix 6: Explicit failure / stale feedback in UI

**Problem:** When activeTabId was invalid or state is empty/stale, the UI shows generic “waiting” with no explanation.

**Approach:** Detect “reconnected but no tabs” / “activeTabId was invalid and we normalized” / “state empty after full dump” and show a clear message and optional “Reload session” (if server supports a full-state request).

**Design:**

- **Detection:** In the client, after applying `SET_FULL_STATE`: if `Object.keys(tabs).length === 0` → “No session data. Start a change from your IDE.” If we normalized `activeTabId` (e.g. we had to fallback to first tab or null) → could set a flag “activeTabWasInvalid”. If we have tabs but the server sent `stateLoadStatus: 'stale'` or similar (optional server field) we could show “Data may be outdated.”
- **UI:** Add a small banner or inline message when `tabs` is empty after connect: “No session data. Run a DevFlo workflow from your project to see progress here.” When we have tabs and connection is “connected”, no extra banner unless we add “last update” (Fix 4). Optional: “Reload session” button that sends a client message (e.g. `type: "request_full_state"`) and server responds with a new full dump; then we can clear “stale” or “invalid active tab” state.
- **Server:** Optional: support `request_full_state` so client can request a fresh full dump (e.g. re-run buildFullDump and send to that client only). Enables “Reload session” without reconnecting.

**Outcome:** User sees an explicit message when there is no session or when something is wrong; optional “Reload session” improves recoverability.

---

## Implementation order (recommended)

1. **state.ts:** Manifest repair in `loadState` and normalize `activeTabId` in returned manifest.
2. **server.ts:** Normalize `activeTabId` in `buildFullDump()`; implement apply functions for relay payloads and call them in `handleInternalConnection` before `broadcast(msg.payload)`.
3. **DashboardContext.tsx:** Normalize `activeTabId` in `SET_FULL_STATE` when it is not in `tabs`.
4. **UI:** Empty-state message when `tabs` is empty after connect; optional “Last update” in state message and UI.
5. **Optional:** Reload from disk on browser connect; `request_full_state` and “Reload session” button.

---

## Boundaries

- **WebSocket protocol:** Optional new fields on `state` message (`lastUpdate`, `stateLoadStatus`); optional new client message `request_full_state` and server response with full state.
- **State persistence:** No change to file format; manifest may be rewritten by `loadState` when files are missing.
- **MCP tools:** No signature or behavior change; relay application is internal to the server.

---

## Risks and mitigations

- **Relay apply logic drift:** If new message types are added, relay handler must be updated. Mitigation: centralize “apply this message to primary state” in one place and add tests for each message type.
- **Order of operations:** Apply then broadcast so that the next full dump (e.g. on next connect) includes the update. Persist after apply so disk stays in sync.
- **Performance:** Applying relay and persisting on every update could add latency; acceptable for typical dashboard load. If needed, batch persists or debounce (out of scope for initial fix).

---

## Testing strategy

- **Unit:** `loadState` with missing/corrupt files repairs manifest and returns valid `activeTabId`. `buildFullDump` with `activeChangeId` not in `changeStates` returns `activeTabId` in tabs or null.
- **Integration:** Start primary and secondary; run tools from secondary; verify primary’s in-memory state (and disk) matches; simulate client connect and assert full dump content. Close browser, reconnect, assert session is present.
- **UI:** Connect with empty tabs → see “No session data” message. Connect with invalid activeTabId (mock) → active tab falls back to first; no blank screen.
