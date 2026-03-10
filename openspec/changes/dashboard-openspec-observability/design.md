# Design: Dashboard OpenSpec Observability

## Overview

This change improves OpenSpec observability on the DevFlo MCP dashboard by (1) giving the spec area a clear, persistent placement with phase/gate-aware default selection, (2) keeping spec content in sync via a manual Refresh button and refresh-on-dashboard-tab-focus (no polling), (3) showing last-modified timestamps per spec file, (4) adding at-a-glance summary cards, (5) providing "Open in Cursor" (open folder / copy path / open file as decided), and (6) surfacing agent activity (phase, task, and current file when available). The existing FileViewer is replaced by a dedicated **Specs** area (side panel or elevated inline per placement decision). Specs remain read-only; all behavior is a single release.

Technical approach: extend the HTTP file API to return last-modified for list responses; add optional agent-activity state (phase/task already in state, optional current-file via small server/state extension); refactor dashboard layout to host a dedicated spec area with gate-aware default tab, refresh-on-focus and manual refresh, timestamps, summary cards, and Open-in-Cursor actions. No duplicate spec areas—one canonical Specs surface.

---

## Structured decisions for user (confirm or override)

**User-confirmed choices (locked):**

### 1. Placement — **A. Resizable side panel** ✓

Specs in a right-side panel beside main content so the user can read spec and approve in one view.

### 2. Summary cards — **A. Task + recency** ✓

Task progress (e.g. "3/7 tasks") and latest spec last-modified among proposal/design/tasks only. No AC-count heuristic.

### 3. Open in Cursor — **App-wide "Open project in Cursor" + Specs-area actions** ✓

- **App-wide:** One "Open in Cursor" button visible across the dashboard (e.g. in header or toolbar) that opens the **project** (project root) in Cursor. The client needs the project path from the server (e.g. included in state dump or via a small API).
- **In Specs area:** Keep "Open change folder" and per-file "Copy path" (and optionally "Open file") for the active change workspace.

### 4. Agent activity — **B. Phase + task + optional current file** ✓

Phase and task from existing state; add optional "current file" when the agent reports it (new MCP tool or param).

---

## Components / modules changed

- **`src/mcp/http.ts`**  
  - Extend `/api/files/list` response to include last-modified time per file (e.g. `files: { name, mtime }[]`) so the UI can show timestamps without a second request.

- **`src/mcp/server.ts`**  
  - Include optional agent-activity field (e.g. `currentFile`) in change state and in `buildFullDump()` so the dashboard can show "current file" when the agent sets it.
  - Add one new MCP tool (e.g. `devflo_set_agent_activity`) with optional `currentFile` parameter, or extend an existing tool (e.g. `devflo_update_tasks` or `devflo_log_event`) to accept optional `currentFile` and store it in change state. Server persists and broadcasts it with state.

- **`src/mcp/state.ts`**  
  - Add optional field to `ChangeState` for agent activity (e.g. `currentFile?: string`). Serialized/deserialized with existing state.

- **`src/mcp/ui/src/types.ts`**  
  - Add optional `currentFile` (or equivalent) to `ServerTabState` / `TabState` and to `ActiveTabView` so the UI can show it.

- **`src/mcp/ui/src/App.tsx`**  
  - Layout change: introduce a right-side resizable Specs panel (or alternative per placement decision). Render the new Specs area component when `changeContext?.workspacePath` is set; remove or replace the current inline `FileViewer` usage so there is only one spec surface.

- **`src/mcp/ui/src/components/FileViewer.tsx`**  
  - Refactored or replaced by a new **Specs** component (e.g. `SpecPanel.tsx` or `SpecsArea.tsx`) that: (1) lists proposal, design, tasks (and optionally .openspec.yaml) with phase-aware default tab; (2) fetches content via existing `/api/files` and list via extended `/api/files/list` (with mtime); (3) shows last-modified per file; (4) provides manual Refresh and participates in refresh-on-tab-focus; (5) shows summary cards; (6) provides Open-in-Cursor actions (folder + per-file copy path, and optionally open file). FileViewer behavior is preserved or improved inside this single component; no duplicate spec areas.

- **`src/mcp/ui/src/context/DashboardContext.tsx`**  
  - Handle new state fields (e.g. `currentFile`) from server messages if we add an update type; expose in `ActiveTabView` for the Specs area and any agent-activity UI.

- **New UI components (as needed)**  
  - **SpecPanel** (or **SpecsArea**): main spec viewer with tabs, content, timestamps, refresh, summary cards, Open change folder + per-file copy path.
  - **Summary cards**: small component(s) showing task progress and latest spec modified time only (no AC heuristic).
  - **App-wide "Open in Cursor"**: button (e.g. in header/toolbar) that opens the project root in Cursor; requires server to expose project path to client (e.g. in state dump or GET /api/project).
  - **Agent activity hint**: compact line or badge showing current phase, current task, and optional current file (e.g. in ChangeHeader or next to phase timeline).

- **Resize behavior (if side panel)**  
  - A resizable split between main content and the Specs panel (e.g. drag handle, store width in localStorage), with a minimum width and collapse/expand.

---

## Data & control flow

1. **Workspace path**  
   - Comes from `changeContext.workspacePath` (set by `devflo_set_change_context`). The Specs area is shown only when this is set for the active tab.

2. **File list and timestamps**  
   - UI calls `GET /api/files/list?dir=<workspacePath>`. Server responds with `{ dir, files: [ { name, mtime } ] }` (mtime ISO string). UI uses this for tab labels and last-modified display.

3. **File content**  
   - Unchanged: `GET /api/files?path=<relPath>`. Used when user selects a tab or after refresh; response `{ path, content }`.

4. **Phase/gate-aware default**  
   - When rendering the Specs area: if `gatePending?.gate === 'A'` default selected tab to proposal; if `gatePending?.gate === 'B'` default to design; else default to proposal. User can switch to any tab.

5. **Refresh**  
   - Manual: "Refresh" button in the Specs area refetches file list (with mtimes) and refetches content for the currently selected file.  
   - On focus: when the document gains visibility (e.g. `visibilitychange` to visible), trigger the same refetch for the active tab’s Specs area (only when dashboard tab is focused, no polling).

6. **Summary cards**  
   - Task progress: from `state.tasks` (completed count / total).  
   - Latest modified: max of mtimes from the file list for proposal/design/tasks. No AC-count heuristic.

7. **Open in Cursor**  
   - **App-wide:** "Open in Cursor" button (e.g. in header) opens the **project root** in Cursor. Client gets project path from server (e.g. `projectPath` in app-level state or GET /api/project). Use `vscode://file/<projectPath>` (or Cursor equivalent) or copy project path to clipboard if URL not supported.  
   - **In Specs area:** "Open change folder" opens the change workspace folder (or copy path); per file "Copy path"; optional "Open file" per file.

8. **Agent activity**  
   - Phase and current task: from existing `state.currentPhase` and `state.tasks` (task with status `in_progress`).  
   - Current file: from new optional `state.currentFile` (or equivalent), set when the agent calls the new tool or extended param; server stores in change state and includes in full state dump and in incremental updates if we add a message type.

---

## Boundaries affected

- **HTTP API**  
  - `GET /api/files/list`: response shape extended to include `mtime` per file (backward-compatible if UI tolerates missing mtime).

- **WebSocket / state**  
  - Optional new field in tab state (e.g. `currentFile`). New MCP tool or extended tool params; new or extended server message for updates if we want incremental updates for current file.

- **Dashboard layout**  
  - Main content vs Specs area (resizable side panel per user choice); single canonical Specs surface, no duplicate FileViewer. App-wide "Open in Cursor" in header/toolbar.

- **MCP tools**  
  - One new tool (e.g. `devflo_set_agent_activity`) or extension of existing tool to set optional `currentFile` (and possibly phase/task override); read path remains via existing state.

---

## Interface changes (prose only)

- **`/api/files/list`**  
  - Query: unchanged (`dir`).  
  - Response: currently `{ dir, files: string[] }`. Extended to `{ dir, files: Array<{ name: string, mtime?: string }> }` where `mtime` is ISO date string of file mtime. Existing callers that expect `files` as strings can be updated to use `name`; new UI uses `mtime` for display.

- **Change state (server)**  
  - Add optional `currentFile?: string` (relative or absolute path, or display string) to in-memory and persisted change state. Included in `buildFullDump()` for each tab.

- **MCP tool**  
  - New: e.g. `devflo_set_agent_activity({ currentFile?: string })` — sets current file for the active change, non-blocking, optional. Or extend `devflo_update_tasks` to accept optional `currentFile` for the active change when tasks are updated.

- **Client state types**  
  - `ServerTabState` / `TabState`: add optional `currentFile?: string`.  
  - `ActiveTabView`: include `currentFile` so Specs/header can show it.

- **App-level state or API**  
  - Client must receive project root path for app-wide "Open in Cursor". Option: add `projectPath?: string` to the state payload sent to the client (e.g. in full dump or handshake), or add `GET /api/project` returning `{ projectPath }`. Server already has `projectPath` (e.g. process.cwd() at startup).

- **SpecPanel (or SpecsArea) component**  
  - Props: `workspacePath: string`, `gatePending: GatePending | null`, `tasks`, `onRefresh?: () => void`.  
  - Fetches list (with mtime) and content; manages selected tab with gate-aware default; exposes Refresh button and uses visibility API for refresh-on-focus; renders summary cards (task progress + latest mtime only) and Open change folder + per-file copy path.  
  - No programmatic editing of spec content; read-only.

- **DashboardContext**  
  - If server sends `currentFile` in state or in an update message, context stores it and exposes via `state.currentFile` (or equivalent).

---

## Key decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Placement | Resizable side panel **(user confirmed A)** | Read and approve in one view. |
| Summary cards | Task progress + latest spec mtime only **(user confirmed A)** | Simple; no AC heuristic. |
| Open in Cursor | **App-wide:** one button opens project in Cursor **(user requested)**. In Specs area: open change folder + per-file copy path (optional open file). | User needs app-wide "Open project in Cursor"; server exposes project path to client. |
| Agent activity | Phase + task from state; optional current file via new/updated MCP **(user confirmed B)** | Better observability with small server extension. |
| Timestamps | Extend `/api/files/list` with mtime | Single request for list + timestamps; no new endpoint. |
| Refresh | Manual button + on dashboard tab focus (visibility API) | No polling; within confirmed scope. |
| Single spec surface | Replace inline FileViewer with one Specs area (side panel) | No duplicate spec areas. |

---

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Layout complexity / cramped UI | Medium | Medium | Use a resizable panel with min width and collapse; test on small viewports; consider elevated inline as fallback. |
| Duplicate spec areas | Low | Medium | Remove or fully replace FileViewer usage in main content; single Specs area only. |
| Refresh-on-focus over-refreshes | Low | Low | Only trigger refetch when `document.visibilityState === 'visible'` and we have an active tab with workspacePath. |
| Agent-activity API scope creep | Low | Low | Add only one optional field and one small tool or param; no streaming or heavy telemetry. |
| Project path exposure | Low | Low | Server already has projectPath; add to state or GET /api/project; document for client. |
| Cursor/VS Code URL scheme differs | Low | Low | Prefer copy path as primary; open-via-URL as enhancement; document behavior. |

---

## Codebase context

- **Dashboard**: React + Vite in `src/mcp/ui/`. State from WebSocket in `DashboardContext`; `deriveActiveTabView` produces `state` for the active tab. Components use `useDashboard()` for `state` and `appState`.
- **Layout**: `App.tsx` has top `TabBar`, then `flex` with `PhaseTimeline` (left) and `main` (right) containing `ChangeHeader`, `ReconnectBanner`, and a scrollable `div` with `QuestionCard`, `GateApprovalCard`, `FileViewer`, `TaskBoard`, `QAResultsPanel`, `TestSummaryPanel`, `AnswerHistory`, `ActivityLog`. Adding a right-side Specs panel implies: `PhaseTimeline | main (header + scrollable content) | SpecPanel` with a resizable split.
- **FileViewer**: Uses `workspacePath`; fetches list via `/api/files/list`, content via `/api/files?path=`; local state for `files`, `activeFile`, `content`, `loading`, `collapsed`; has a per-file refresh that only reloads current file. No timestamps, no gate-aware default, no summary cards, no Open in Cursor.
- **Gate**: `state.gatePending` has `gate: 'A' | 'B'`, `phaseName`, `sessionId`, `summary`, `stale`. Gate A → proposal, Gate B → design.
- **State**: `ChangeState` in `state.ts` holds `changeContext`, `phases`, `currentPhase`, `tasks`, `pendingGate`, etc. Persisted per change in `.cursor/mcp/state/<changeId>.json`. `buildFullDump()` in server builds the object sent to the client; new optional field must be added there and in client types.
- **HTTP**: `createStaticServer` in `http.ts` uses `getProjectPath`; `handleFileRead` serves `/api/files` and `/api/files/list`; path is resolved against `projectPath` with traversal check; allowed extensions include `.md`, `.yaml`, `.yml`, etc. Listing uses `readdirSync` + `statSync`; we can add `mtime` from `statSync` to the list response.
- **Conventions**: Tailwind with custom tokens (e.g. `surface-1`, `accent-purple`, `text-text-muted`). Existing `formatRelativeTime` in `PhaseTimeline.tsx` can be reused or moved for "X min ago" timestamps.

---

## Testing strategy

- **Unit**  
  - HTTP: list handler returns `mtime` for each file when present; path traversal and missing dir unchanged.  
  - State: optional `currentFile` round-trips in change state save/load.  
  - Project path: client receives projectPath (state or API) for app-wide Open in Cursor.

- **Integration**  
  - Dashboard: with mock WebSocket state (gate A pending), Specs area shows proposal as default tab; with gate B pending, design as default.  
  - Refresh: manual Refresh updates content; visibility change (mock) triggers refetch when visible.  
  - Open in Cursor: app-wide button opens project (or copies path); Specs-area open change folder and copy path work correctly.

- **Regression**  
  - Existing flows: questions, gate approval, tasks, QA, test summary, activity log, tabs, and existing FileViewer behavior (reading proposal/design/tasks) are preserved or improved; no duplicate spec areas; layout remains usable on small viewports.

- **Manual**  
  - Resize panel; collapse/expand; summary cards reflect task progress and latest mtime; app-wide "Open in Cursor" opens project; agent activity shows phase, task, and current file when set via MCP.

---

## Summary

- **Placement**: Resizable side panel **(user confirmed)**.  
- **Summary cards**: Task progress + latest spec last-modified only **(user confirmed A)**.  
- **Open in Cursor**: **App-wide** "Open in Cursor" button opens the **project** in Cursor **(user requested)**; server exposes project path to client. In Specs area: open change folder + per-file copy path (optional open file).  
- **Agent activity**: Phase + task from state; optional current file via new/updated MCP **(user confirmed B)**.  
- **Single release**: All of the above in one release; specs read-only; one Specs area, no duplicate FileViewer.
