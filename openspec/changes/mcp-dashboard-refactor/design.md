# MCP Dashboard Refactor — Technical Design

## Overview

This refactor transforms the MCP dashboard from a single-change, in-memory model to a multi-tab, disk-persisted architecture. The server will hold a map of change states keyed by change ID, persist all state to disk with atomic writes, enforce an archive cap for bounded growth, and fix the dual-browser-window bug. The UI will display tabs per change, support tab close with confirmation, and receive a full state dump on WebSocket reconnect. Pending questions and gates will survive reconnect (same process) and appear as stale/expired after server restart.

## Components / Modules Changed

### Server

- **`src/mcp/server.ts`** — Core refactor. Replace single `dashState` with `Map<changeId, ChangeState>`. Add `activeChangeId` (last `set_change_context`). Keep `pendingQuestions` and `pendingGates` keyed by sessionId (globally unique). Route all MCP tool calls to the active change. Add state persistence module integration: load on start, save on every mutation. Change `ensureBrowserOpen()` to only check `!hasBrowserOpened()`. On WebSocket connect, send full dump (all tabs, activeTabId, pending interactions with stale flag). Handle `tab_close` message: delete state file, remove from map, broadcast update. Handle `answer` and `gate_action` with change-scoped session IDs.

- **`src/mcp/launcher.ts`** — Remove `-n` flag from macOS `open` commands so the existing browser window is reused instead of forcing a new instance. Commands change from `open -na "Google Chrome"` to `open -a "Google Chrome"` (or equivalent that reuses window).

- **`src/mcp/state.ts`** (new) — State persistence module. Exposes: `loadState(projectPath)`, `saveChangeState(projectPath, changeId, state)`, `deleteChangeState(projectPath, changeId)`, `archiveOldestIfNeeded(projectPath)`. Uses atomic write (write to `.tmp`, then rename). Manages `manifest.json` and `{changeId}.json` under `{projectPath}/.cursor/mcp/state/`. Archive: `archive/` subfolder; when active count exceeds 20, move oldest file (by mtime) to archive.

### UI

- **`src/mcp/ui/src/types.ts`** — Add `TabState` (per-change state: changeContext, phases, tasks, events, qaResults, testSummary, history, questionBatch, gatePending, stale flag for pending). Add `AppState`: `tabs: Record<changeId, TabState>`, `activeTabId: string | null`, `connectionStatus`. Extend `ServerMessage` with new `state` shape (tabs object, activeTabId) and `tab_close` client message.

- **`src/mcp/ui/src/context/DashboardContext.tsx`** — Replace single `DashboardState` with `AppState`. Reducer handles `SET_FULL_STATE` (replace entire state from server), `SET_ACTIVE_TAB`, `TAB_CLOSE`, and per-tab updates. `submitAnswers` and `submitGateAction` must include `changeId` in payload. Add `closeTab(changeId)` that shows confirmation, then sends `tab_close`. Active tab's state drives the main content area (ChangeHeader, PhaseTimeline, TaskBoard, etc.).

- **`src/mcp/ui/src/App.tsx`** — Add tab bar above main content. Each tab shows change name; active tab highlighted. Tab close button triggers confirmation flow. Main content renders the active tab's state; when no tabs, show empty state.

- **`src/mcp/ui/src/components/QuestionCard.tsx`** — Read `questionBatch` from active tab. When `stale: true`, show visual indicator (e.g. "Session expired — this question is no longer answerable") and disable submit.

- **`src/mcp/ui/src/components/GateApprovalCard.tsx`** — Read `gatePending` from active tab. When `stale: true`, show "Session expired" and disable buttons.

- **`src/mcp/ui/src/components/ChangeHeader.tsx`** — Read from active tab. Add close button that triggers tab close flow.

- **`src/mcp/ui/src/components/PhaseTimeline.tsx`**, **TaskBoard.tsx**, **ActivityLog.tsx**, **QAResultsPanel.tsx**, **TestSummaryPanel.tsx**, **AnswerHistory.tsx** — All read from active tab state instead of global state.

## Data & Control Flow

### State Flow

1. **Server start**: Load manifest from `{projectPath}/.cursor/mcp/state/manifest.json`. For each change ID in manifest, load `{changeId}.json` into memory map. All loaded pending interactions are marked `stale: true` (server restarted; agent session gone). Set `activeChangeId` from manifest's `activeTabId` if present.

2. **MCP tool call**: Orchestrator calls `devflo_set_change_context` with change name → `changeId`. Server creates or updates change state, sets `activeChangeId`. All subsequent tool calls apply to that change until next `set_change_context`.

3. **State mutation**: Any tool that mutates state (update_phase, update_tasks, log_event, etc.) updates the in-memory map for the active change, then calls `saveChangeState(projectPath, changeId, state)`. After save, `archiveOldestIfNeeded(projectPath)` runs. Broadcast to client if connected.

4. **Pending interaction**: `devflo_ask_user` or `devflo_await_gate` creates a pending entry in the active change's state, persists it, and stores a `PendingPromise` keyed by `sessionId` (globally, since session IDs are unique). When client sends `answer` or `gate_action`, resolve the promise. Pending interactions created in the current session are `stale: false`; those loaded from disk are `stale: true`.

5. **WebSocket connect**: Client connects. Server sends a single `state` message: `{ type: "state", tabs: { [changeId]: TabState }, activeTabId }`. Each `TabState` includes `questionBatch` and `gatePending` with `stale` flag. Client replaces entire state.

6. **Tab close**: User clicks close on tab → confirmation dialog "Closing this tab will permanently delete its data. Continue?" → On confirm, client sends `{ type: "tab_close", changeId }`. Server deletes state file, removes from map, updates manifest. Broadcasts updated state (or `tab_closed` with changeId) to client.

### Reconnect vs Restart

- **Reconnect** (same process, client disconnected and reconnected): Pending interactions in memory are live (`stale: false`). Full dump includes them; user can answer.

- **Restart** (server process restarted): State loaded from disk. All pending interactions marked `stale: true`. Full dump sends them; UI shows "Session expired" and disables answer/gate actions.

## Boundaries Affected

- **Server–client WebSocket protocol**: New `state` message shape (tabs object, activeTabId). New client message `tab_close`. Existing messages (`phase_update`, `tasks_update`, etc.) must include `changeId` so client can route to the correct tab, or server broadcasts full state for the affected change.

- **File system**: New directory `{projectPath}/.cursor/mcp/state/` with `manifest.json`, `{changeId}.json`, and `archive/` subfolder.

- **MCP tool handlers**: No signature changes. Internal routing by `activeChangeId`.

## Interface Changes

### Server State Persistence Module

- **`loadState(projectPath: string)`**: Returns `{ changeStates: Map<string, ChangeState>, activeTabId: string | null }`. Reads manifest, then each change file. Marks all loaded pending interactions as stale. If a file is missing or corrupt, skip that change and continue.

- **`saveChangeState(projectPath: string, changeId: string, state: ChangeState)`**: Writes state to `{changeId}.json` using atomic write (write to `{changeId}.json.tmp`, then rename). Updates manifest to include changeId and preserve activeTabId. Calls `archiveOldestIfNeeded` after save.

- **`deleteChangeState(projectPath: string, changeId: string)`**: Deletes `{changeId}.json`, removes from manifest.

- **`archiveOldestIfNeeded(projectPath: string)`**: If active change count exceeds 20, finds the change file with oldest mtime (excluding the most recently saved one to avoid archiving the current write), moves it to `archive/{changeId}.json`, removes from manifest.

### WebSocket Messages

- **Server → Client `state`**: Object with `type: "state"`, `tabs: Record<changeId, TabState>`, `activeTabId: string | null`. Each `TabState` has changeContext, phases, tasks, events, qaResults, testSummary, history, questionBatch (with `stale?: boolean`), gatePending (with `stale?: boolean`).

- **Client → Server `tab_close`**: Object with `type: "tab_close"`, `changeId: string`.

- **Existing messages** (`phase_update`, `tasks_update`, etc.): Add `changeId` field so client can apply update to the correct tab. Alternatively, server can broadcast full tab state for that change; full dump per update is acceptable for simplicity.

### Client Context

- **`state`**: `AppState` with `tabs`, `activeTabId`, `connectionStatus`.

- **`activeTab`**: Derived getter — `state.tabs[state.activeTabId]` or null.

- **`closeTab(changeId: string)`**: Shows confirmation; on confirm, sends `tab_close`, then dispatches local removal (or waits for server broadcast).

- **`setActiveTab(changeId: string)`**: Dispatches `SET_ACTIVE_TAB`; optionally notify server for manifest persistence of activeTabId.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Reconnect format | Full dump | Single message, client replaces state. Simpler protocol and client logic. |
| Atomic write | Write to `.tmp`, then rename | Standard pattern; atomic on most filesystems. |
| Large manifest | Cap + archive (max 20) | Bounded growth. Oldest by file mtime moved to `archive/`. |
| Stale detection | Loaded-from-disk = stale | Pending interactions created in current session are live; any loaded on startup are from a prior process, hence stale. |
| Tab close | Client-initiated, server deletes | Client sends `tab_close`; server deletes file and removes from map. Clean handshake. |
| ensureBrowserOpen | Only `!hasBrowserOpened()` | Removes `noClient` from condition to fix race; rapid calls no longer open multiple windows. |
| Launcher | Remove `-n` from macOS open | Reuse existing browser window instead of forcing new instance. |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| State file corruption | Low | High | Atomic write; temp file then rename. |
| Archive logic wrong | Medium | Medium | Unit tests for archive; verify oldest-by-mtime. |
| Tab close during pending | Low | Low | Acceptable. MCP call times out; user chose to close. |
| Large manifest load | Low | Low | Cap at 20; archive keeps load bounded. |
| Stale flag wrong | Medium | Medium | Clear rule: disk = stale, in-memory = live. |
| Full dump too large | Low | Low | 20 tabs max; JSON payload acceptable. |

## Codebase Context

- **Patterns**: Server uses `process.cwd()` for project path; port file at `{projectPath}/.cursor/mcp/.devflo-port`. State directory will live alongside. Existing `port.ts` uses `join`, `mkdirSync`, `writeFileSync`; state module will follow same pattern.

- **Conventions**: MCP tools use `z` for schema validation. Tool handlers are async; `waitForClientSend` retries every 500ms. `enrichPhases` and `computeTaskProgress` are change-scoped helpers.

- **Key files**: `server.ts` (~730 lines) — will need refactor into smaller modules (state persistence, change state helpers) to stay under 800 lines per file.

- **UI**: React context uses `useReducer`; `useWebSocket` handles reconnect. Message handler switches on `msg.type`. Components consume `useDashboard()`.

- **Gotchas**: `setBrowserOpened(false)` on WebSocket close — keep this; browser may have closed. `pendingQuestions` and `pendingGates` are keyed by sessionId; session IDs are globally unique, so no changeId needed in the map. But we need to route answers back to the correct change's state when resolving (e.g. update phase gateStatus). Actually, the promise resolves to the MCP tool — the tool already has the change context. So we're fine.

## Testing Strategy

| Classification | Strategy |
|----------------|----------|
| **Regression** | Preserve existing behavior: single change works as before; phase updates, tasks, events, QA, test summary all flow correctly. |
| **Unit** | State persistence: `loadState`, `saveChangeState`, `deleteChangeState`, `archiveOldestIfNeeded`. Atomic write: verify temp-then-rename. Archive: verify oldest-by-mtime when cap exceeded. |
| **Integration** | Server restart: load state from disk, verify pending marked stale. WebSocket reconnect: full dump received, client state replaced. Tab close: `tab_close` received, file deleted, map updated. |
| **Boundary** | `ensureBrowserOpen` with rapid calls: no duplicate windows. Launcher: `open` without `-n` reuses window. |
| **E2E** | Manual: run devflo, trigger MCP tools rapidly, confirm single window. Multiple changes, verify tabs. Close tab, confirm deletion. |
