# Tasks: Dashboard Data Consistency

## Task 1: Repair manifest in loadState when change files are missing

**Description:** In `state.ts`, change `loadState(projectPath)` so that after reading change files, it builds the set of successfully loaded change IDs. Compute `activeTabId` as the manifest's `activeTabId` only if that ID is in the loaded set, otherwise use the first loaded ID or null. Write the manifest back with `changeIds` set to the loaded IDs and the computed `activeTabId` so the manifest never references missing files.

**Done criteria:**
- `loadState` returns `activeTabId` only when that change was successfully loaded.
- Manifest on disk is updated when any change ID in manifest could not be loaded (so next load is consistent).
- Existing unit tests in `state.test.ts` still pass; add tests for missing file and corrupt file (manifest repaired, activeTabId normalized).

**Dependencies:** None

**Status:** completed

---

## Task 2: Normalize activeTabId in buildFullDump and in SET_FULL_STATE

**Description:** In `server.ts`, in `buildFullDump()`, set `activeTabId` to `activeChangeId` only if `changeStates.has(activeChangeId)`, else first key of `changeStates` or null. In `DashboardContext.tsx`, in the `SET_FULL_STATE` reducer branch, if `action.activeTabId` is not in `action.tabs`, set `activeTabId` to `Object.keys(action.tabs)[0] ?? null`.

**Done criteria:**
- Server never sends an `activeTabId` that is not present in `tabs`.
- Client normalizes invalid `activeTabId` so UI never shows blank due to missing tab.

**Dependencies:** None (can run in parallel with Task 1)

**Status:** completed

---

## Task 3: Primary applies relayed messages to its state and persists

**Description:** In `server.ts`, add apply functions that update primary's `changeStates` and call `persistChange` for each relay message type: `phase_update`, `tasks_update`, `event`, `change_context`, `qa_update`, `test_summary_update`, `questions`, `gate_request`, `tab_closed`. In `handleInternalConnection`, when receiving `msg.type === "relay"` and `msg.payload`, call the appropriate apply function for `msg.payload.type`, then call `broadcast(msg.payload)`.

**Done criteria:**
- All relay payload types that mutate state are applied to primary's `changeStates` and persisted.
- `tab_closed` removes the change from map and updates `activeChangeId`; `change_context` creates/updates change and sets `activeChangeId`.
- Existing tool handlers unchanged; integration test: secondary runs tools, primary state and disk match; client reconnect gets full dump with that state.

**Dependencies:** None

**Status:** completed

---

## Task 4: Empty-state and failure messaging in UI

**Description:** When after `SET_FULL_STATE` the client has no tabs (`Object.keys(tabs).length === 0`) and connection is connected, show an explicit message (e.g. "No session data. Run a DevFlo workflow from your project to see progress here.") instead of the generic waiting state. Optionally set a derived flag when `activeTabId` was normalized so we could show "Session recovered" or similar (minimal: just empty-state message).

**Done criteria:**
- User sees a clear message when there is no session data after connecting.
- No functional regression in existing empty/waiting states.

**Dependencies:** Task 2 (so we have consistent tabs/activeTabId)

**Status:** completed

---

## Task 5 (optional): Last-update indicator

**Description:** Server sets a module-level `lastUpdateTime` (ISO string) on every state mutation (including when applying relay). Include `lastUpdate` in the `state` message in `buildFullDump()`. UI stores it and displays "Last update: &lt;relative time&gt;" in header or ReconnectBanner area.

**Done criteria:**
- Full dump includes `lastUpdate` when available.
- UI shows relative time since last update when connected.

**Dependencies:** None

**Status:** completed

---

## Task 6 (optional): Reload from disk on browser connect

**Description:** In primary's WebSocket connection handler for browser clients, before sending the full dump, call `loadState(projectPath)` and replace `changeStates` and `activeChangeId` with the loaded values, then build and send the dump. Ensures first connect after restart sees latest disk state.

**Done criteria:**
- First browser connect after primary start gets state from disk (merge or replace).
- No impact on internal relay connections.

**Dependencies:** Task 1 (manifest repair)

**Status:** completed

---

## Task 7 (optional): request_full_state and "Reload session" button

**Description:** Add client message type `request_full_state`. Server handles it by sending a full dump to that client only. UI adds a "Reload session" button (e.g. when connection is connected but user wants to refresh); on click, send `request_full_state` and apply incoming `state` message.

**Done criteria:**
- Client can request a fresh full state without reconnecting.
- Button visible when appropriate; no breaking change to existing flow.

**Dependencies:** None

**Status:** completed
