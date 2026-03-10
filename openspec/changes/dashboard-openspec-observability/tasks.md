# Tasks: Dashboard OpenSpec Observability

Ordered, dependency-aware task list. Each task is execution-ready with clear done criteria and related acceptance criteria (AC).

---

## Task 1: Extend file list API to return last-modified timestamps

**Description:**  
Extend the HTTP endpoint `GET /api/files/list` so the response includes a last-modified time (mtime) for each file. Response shape becomes e.g. `{ dir, files: Array<{ name, mtime?: string }> }` with mtime as ISO string. Preserve path traversal and error behavior; ensure existing callers can use the new shape (UI will use `name` and `mtime`).

**Done criteria:**
- `/api/files/list?dir=<path>` returns `files` as array of objects with at least `name` and optional `mtime` (ISO).
- Path traversal and security checks unchanged.
- Unit or integration test covers list response shape and mtime presence for a known directory.

**Dependencies:** None.

**Related AC:** 6 (last-modified timestamps visible).

**Status:** completed

---

## Task 2: Add optional agent-activity state (currentFile) and MCP support

**Description:**  
Add optional `currentFile` (or equivalent) to server change state and to the state sent to the client in `buildFullDump()`. Add one MCP tool (e.g. `devflo_set_agent_activity`) with optional `currentFile` parameter that sets this field for the active change and persists it, or extend an existing tool (e.g. `devflo_update_tasks`) to accept optional `currentFile`. Update `state.ts` and client types (`ServerTabState`, `TabState`, `ActiveTabView`) to include the new field.

**Done criteria:**
- Change state (in-memory and persisted) includes optional `currentFile`.
- New or extended MCP tool sets `currentFile` for the active change; state is persisted and included in full state dump.
- Client types and reducer/store the new field; it is exposed on the active tab view.
- Test(s) cover state round-trip and tool invocation.

**Dependencies:** None.

**Related AC:** 9 (agent activity hinted; current file when available).

**Status:** completed

---

## Task 3: Dashboard layout — add Specs panel and remove duplicate FileViewer

**Description:**  
Refactor the dashboard layout to host a dedicated Specs area. If placement is side panel: add a resizable right-side panel (resize handle, min width, collapse/expand; optionally persist width in localStorage). Render the new Specs area component when the active tab has `changeContext?.workspacePath`. Remove the inline `FileViewer` from the main scroll area so there is only one spec surface. Ensure gate card and main content remain visible alongside the panel (or adapt for chosen placement).

**Done criteria:**
- Single canonical Specs area (no duplicate Workspace Files / FileViewer in main content).
- Layout supports "read and approve in one place" (e.g. gate card and spec visible without scrolling for side panel).
- Resize (and collapse if side panel) works; layout is usable on small viewports.

**Dependencies:** None (layout only; Specs content can be placeholder initially).

**Related AC:** 1 (OpenSpec docs visible and easy to find), 3 (read and approve in one view), 11 (no regression).

**Status:** completed

---

## Task 4: Specs area — content, tabs, and gate-aware default selection

**Description:**  
Implement the main Specs component (e.g. `SpecPanel` or `SpecsArea`) that lists proposal, design, tasks (and optionally .openspec.yaml). Fetch file list using extended `/api/files/list` (with mtime). Fetch content via existing `/api/files?path=`. Provide tabs for each spec file with phase/gate-aware default: when `gatePending?.gate === 'A'` default to proposal; when `gatePending?.gate === 'B'` default to design; otherwise default to proposal. User can switch to any tab. Markdown and non-markdown rendering same as current FileViewer. Read-only; no editing.

**Done criteria:**
- Specs area shows proposal, design, tasks (and optionally .openspec.yaml) with correct content and tabs.
- Default selected tab is proposal at Gate A, design at Gate B, else proposal.
- All three artifacts accessible from the dashboard; content matches current FileViewer behavior.
- No duplicate spec area elsewhere.

**Dependencies:** Task 1 (mtime used in next task; list shape), Task 3 (layout to host Specs area).

**Related AC:** 2 (relevant spec at gate time), 4 (all three artifacts accessible).

**Status:** completed

---

## Task 5: Refresh — manual button and on dashboard tab focus

**Description:**  
Add a manual "Refresh" button in the Specs area that refetches the file list (with mtimes) and the content of the currently selected file. Implement refresh when the user focuses the dashboard browser tab using the Page Visibility API (`visibilitychange`): when the document becomes visible, trigger the same refetch for the active tab’s Specs area (only when active tab has workspacePath). No polling.

**Done criteria:**
- Manual Refresh button updates list and current file content.
- When the dashboard tab gains focus (visibility visible), Specs area refetches list and current file content for the active tab.
- No polling; no refetch when tab is not focused.

**Dependencies:** Task 4 (Specs area exists).

**Related AC:** 5 (spec content stays up to date via Refresh and on focus).

**Status:** completed

---

## Task 6: Last-modified timestamps in Specs area

**Description:**  
Display last-modified time for each spec file in the Specs area using the mtime from the file list API. Show relative time (e.g. "2 min ago") or absolute time; reuse or adapt existing relative-time formatting (e.g. from PhaseTimeline). Update when list is refetched (manual or on focus).

**Done criteria:**
- Each spec file (proposal, design, tasks) shows last-modified (relative or absolute).
- Timestamps update after Refresh or on tab focus refetch.

**Dependencies:** Task 1, Task 4, Task 5.

**Related AC:** 6 (last-modified timestamps visible).

**Status:** completed

---

## Task 7: Summary cards in Specs area or change header

**Description:**  
Add at least one summary card (or compact summary) with at-a-glance metrics: (1) task progress (e.g. completed/total from `state.tasks`), (2) latest spec last-modified among proposal/design/tasks. No AC-count heuristic. Place in the Specs area or in the change header as defined in design.

**Done criteria:**
- Summary card(s) visible with task progress and latest spec modified time.
- Metrics update when state or spec data changes.

**Dependencies:** Task 4, Task 6 (for latest modified).

**Related AC:** 7 (summary cards present).

**Status:** completed

---

## Task 8: Open in Cursor — app-wide project button and Specs-area actions

**Description:**  
(1) **App-wide:** Add an "Open in Cursor" button visible across the dashboard (e.g. in header or toolbar) that opens the **project root** in Cursor. Client must receive project path from server (e.g. `projectPath` in state dump or GET /api/project). Use `vscode://file/<projectPath>` (or Cursor equivalent) or copy project path to clipboard if URL not supported. (2) **In Specs area:** "Open change folder" opens the change workspace folder (or copy path); per spec file "Copy path"; optionally "Open file" per file. Use project path + workspace path to resolve absolute paths for change folder and files.

**Done criteria:**
- App-wide "Open in Cursor" button opens the project in Cursor (or copies project path).
- User can open the change folder in Cursor (or copy folder path) from Specs area.
- User can copy the path of each spec file (proposal, design, tasks).
- Optional per-file open in Cursor if URL scheme is supported and documented.

**Dependencies:** Task 4 (Specs area with files and paths).

**Related AC:** 8 ("Open in Cursor" available).

**Status:** completed

---

## Task 9: Agent activity — display phase, task, and current file

**Description:**  
Surface agent activity on the dashboard: current phase and current task (from existing state), and current file when available (from new optional state field). Place in ChangeHeader or next to phase timeline (compact line or badge). Current task can be derived from the task with status `in_progress`; current phase from `state.currentPhase`. Show current file only when `state.currentFile` is set.

**Done criteria:**
- Dashboard shows current phase and current task.
- Dashboard shows current file when the agent has set it (via new MCP tool/param).
- No regression to existing header or phase timeline behavior.

**Dependencies:** Task 2 (state and types for currentFile).

**Related AC:** 9 (agent activity hinted).

**Status:** completed

---

## Task 10: Regression and integration verification

**Description:**  
Verify no regression: questions, gate actions (PM APPROVED / ARCH APPROVED, revise, cancel), tasks, QA results, test summary, activity log, tabs, and existing behavior of reading proposal/design/tasks. Run full test suite; confirm layout and responsiveness; ensure single Specs area and no duplicate FileViewer.

**Done criteria:**
- All existing dashboard flows work (questions, gates, tasks, QA, test summary, activity log, tabs).
- Reading full proposal/design/tasks from the dashboard is preserved or improved.
- Test suite passes; integration checks for Specs and refresh pass as defined in testing strategy.

**Dependencies:** Tasks 1–9.

**Related AC:** 10 (no regression).

**Status:** completed

---

## Summary

| # | Title | Dependencies |
|---|--------|---------------|
| 1 | Extend file list API to return last-modified timestamps | None |
| 2 | Add optional agent-activity state (currentFile) and MCP support | None |
| 3 | Dashboard layout — add Specs panel and remove duplicate FileViewer | None |
| 4 | Specs area — content, tabs, and gate-aware default selection | 1, 3 |
| 5 | Refresh — manual button and on dashboard tab focus | 4 |
| 6 | Last-modified timestamps in Specs area | 1, 4, 5 |
| 7 | Summary cards in Specs area or change header | 4, 6 |
| 8 | Open in Cursor — folder and per-file actions | 4 |
| 9 | Agent activity — display phase, task, and current file | 2 |
| 10 | Regression and integration verification | 1–9 |
