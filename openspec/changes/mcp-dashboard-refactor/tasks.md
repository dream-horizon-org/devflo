# Tasks: MCP Dashboard Refactor

## Task 1: Fix dual browser window bug

**Description:** Change `ensureBrowserOpen()` in `server.ts` to only check `!hasBrowserOpened()` — remove the `noClient` condition that causes multiple windows when MCP tools are called rapidly. In `launcher.ts`, remove the `-n` flag from macOS `open` commands so the existing browser window is reused instead of forcing a new instance.

**Done criteria:**
- `ensureBrowserOpen()` condition is `serverPort > 0 && !hasBrowserOpened()`
- macOS commands use `open -a` (or equivalent without `-n`) for Chrome, Edge, Brave
- Rapid MCP tool calls (e.g. 5 within 1 second) open at most one browser window

**Dependencies:** None

**Related acceptance criteria:** Single browser window per project

**Status:** completed

---

## Task 2: Create state persistence module

**Description:** Add `src/mcp/state.ts` with functions: `loadState(projectPath)` returning change states and activeTabId; `saveChangeState(projectPath, changeId, state)` with atomic write (write to `.tmp`, rename); `deleteChangeState(projectPath, changeId)`; `archiveOldestIfNeeded(projectPath)` moving oldest-by-mtime to `archive/` when active count exceeds 20. Define `ChangeState` and manifest schema. State directory: `{projectPath}/.cursor/mcp/state/`.

**Done criteria:**
- All four functions implemented and exported
- Atomic write pattern: write to `{changeId}.json.tmp`, then rename to `{changeId}.json`
- Manifest format: `{ changeIds: string[], activeTabId?: string }`
- Archive moves file to `archive/{changeId}.json` when count > 20
- Unit tests for load, save, delete, archive

**Dependencies:** None

**Related acceptance criteria:** Full state persistence, state file corruption mitigation

**Status:** completed

---

## Task 3: Server — multi-change state structure and load on start

**Description:** Replace single `dashState` with `Map<changeId, ChangeState>`. Add `activeChangeId`. On server start, call `loadState(projectPath)` and populate the map. Mark all loaded pending interactions as `stale: true`. Wire `devflo_set_change_context` to create/update change state and set `activeChangeId`; persist and update manifest with activeTabId.

**Done criteria:**
- Server uses `changeStates: Map<string, ChangeState>` and `activeChangeId: string | null`
- `startMcpServer` loads state from disk before MCP connect
- `devflo_set_change_context` creates tab if new, sets activeChangeId, persists
- Loaded pending interactions have `stale: true`

**Dependencies:** Task 2

**Related acceptance criteria:** Full state persistence, multi-tab support

**Status:** completed

---

## Task 4: Server — route all MCP tools to active change and persist

**Description:** Update `devflo_update_phase`, `devflo_update_tasks`, `devflo_log_event`, `devflo_update_qa_results`, `devflo_update_test_summary` to read/write the active change's state from the map. Call `saveChangeState` after each mutation. Ensure `enrichPhases` and `computeTaskProgress` operate on the active change's state. Broadcast updates include `changeId` so client can route.

**Done criteria:**
- All non-blocking tools mutate active change only
- Each mutation triggers `saveChangeState` and `archiveOldestIfNeeded`
- Broadcast messages include `changeId` field

**Dependencies:** Task 3

**Related acceptance criteria:** Full state persistence, multi-tab support

**Status:** completed

---

## Task 5: Server — pending interactions in change state with stale handling

**Description:** Store `questionBatch` and `gatePending` in each change's state. `devflo_ask_user` and `devflo_await_gate` persist the pending interaction to the active change's state (with `stale: false`). Keep `pendingQuestions` and `pendingGates` maps keyed by sessionId for resolution. On load from disk, mark all pending as `stale: true`. When client sends `answer` or `gate_action`, resolve the promise and clear from change state, persist.

**Done criteria:**
- Pending questions and gates stored in change state and persisted
- In-memory pending created this session have `stale: false`
- Loaded-from-disk pending have `stale: true`
- Answer/gate_action resolve promise, update change state, persist

**Dependencies:** Task 4

**Related acceptance criteria:** Pending on reconnect, full state persistence

**Status:** completed

---

## Task 6: Server — WebSocket full dump, tab_close, set_active_tab

**Description:** On WebSocket connect, send single `state` message with `tabs: Record<changeId, TabState>` and `activeTabId`. Handle client message `tab_close`: delete state file, remove from map, update manifest, broadcast updated state. Handle `set_active_tab`: update manifest activeTabId, optionally broadcast. Ensure `answer` and `gate_action` still work with change-scoped session IDs.

**Done criteria:**
- Connect sends full dump with all tabs and activeTabId
- `tab_close` deletes file, removes from map, broadcasts
- `set_active_tab` updates manifest
- answer/gate_action routing unchanged

**Dependencies:** Task 5

**Related acceptance criteria:** Pending on reconnect, tab close warning

**Status:** completed

---

## Task 7: UI — add types for multi-tab state

**Description:** In `types.ts`, add `TabState` (changeContext, phases, tasks, events, qaResults, testSummary, history, questionBatch with `stale?`, gatePending with `stale?`). Add `AppState`: `tabs: Record<changeId, TabState>`, `activeTabId: string | null`, `connectionStatus`. Extend `ServerMessage` for new `state` shape (tabs, activeTabId). Add client message type `tab_close` and `set_active_tab`.

**Done criteria:**
- TabState and AppState types defined
- ServerMessage.state has tabs and activeTabId
- Client message types documented

**Dependencies:** None

**Related acceptance criteria:** Multi-tab UI

**Status:** completed

---

## Task 8: UI — refactor DashboardContext for multi-tab state

**Description:** Replace `DashboardState` with `AppState` in context. Reducer handles `SET_FULL_STATE` (replace entire state from server), `SET_ACTIVE_TAB`, `TAB_CLOSE` (local removal). Add `activeTab` derived from `state.tabs[state.activeTabId]`. Update `submitAnswers` and `submitGateAction` to include `changeId` in payload (from activeTabId). Add `closeTab(changeId)` and `setActiveTab(changeId)`.

**Done criteria:**
- Context state is AppState
- SET_FULL_STATE replaces tabs and activeTabId
- submitAnswers/submitGateAction send changeId
- closeTab and setActiveTab exposed

**Dependencies:** Task 7

**Related acceptance criteria:** Multi-tab UI

**Status:** completed

---

## Task 9: UI — tab bar and active tab switching

**Description:** Add tab bar component above main content in `App.tsx`. Each tab displays change name; active tab highlighted. Clicking a tab calls `setActiveTab` and sends `set_active_tab` to server. Main content area renders based on `activeTab`; when no tabs, show empty/waiting state.

**Done criteria:**
- Tab bar shows one tab per change
- Active tab visually distinct
- Tab click switches active tab and notifies server
- Main content reads from activeTab

**Dependencies:** Task 8

**Related acceptance criteria:** Multi-tab UI

**Status:** completed

---

## Task 10: UI — components read from active tab

**Description:** Update `ChangeHeader`, `PhaseTimeline`, `TaskBoard`, `ActivityLog`, `QAResultsPanel`, `TestSummaryPanel`, `AnswerHistory` to read from `activeTab` (or `state.tabs[state.activeTabId]`) instead of global state. Update `QuestionCard` and `GateApprovalCard` to read `questionBatch` and `gatePending` from active tab.

**Done criteria:**
- All listed components use active tab state
- No references to global single-state structure

**Dependencies:** Task 8, Task 9

**Related acceptance criteria:** Multi-tab UI

**Status:** completed

---

## Task 11: UI — tab close with confirmation

**Description:** Add close button to each tab (or tab header). On click, show confirmation dialog: "Closing this tab will permanently delete its data. Continue?" On confirm, call `closeTab(changeId)` which sends `tab_close` to server and dispatches local removal (or waits for server broadcast). On cancel, dismiss dialog.

**Done criteria:**
- Close button on each tab
- Confirmation dialog with exact copy
- On confirm: tab_close sent, tab removed from UI

**Dependencies:** Task 9, Task 10

**Related acceptance criteria:** Tab close warning

**Status:** completed

---

## Task 12: UI — stale indicator for pending interactions

**Description:** When `questionBatch` or `gatePending` has `stale: true`, show visual indicator (e.g. "Session expired — this question is no longer answerable") and disable submit/approve buttons. Styled distinctly (muted/gray) to indicate non-interactive.

**Done criteria:**
- QuestionCard shows stale message and disables submit when stale
- GateApprovalCard shows stale message and disables buttons when stale
- Visual distinction for stale state

**Dependencies:** Task 10

**Related acceptance criteria:** Pending on reconnect (stale after restart)

**Status:** completed

---

## Task 13: Integration verification and test summary

**Description:** Run full test suite. Verify: single browser window on rapid calls; server restart restores state with stale pending; WebSocket reconnect receives full dump; tab close deletes state; multi-tab display and switching work. Document test results.

**Done criteria:**
- All tests pass
- Manual verification of expectation criteria
- Test summary documented

**Dependencies:** Tasks 1–12

**Related acceptance criteria:** All

**Status:** completed
