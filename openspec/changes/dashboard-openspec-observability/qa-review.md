# Phase 4 — QA | Change: dashboard-openspec-observability | Full Review #1

## Verdict: **QA PASS**

Zero Blockers and zero Majors. Minor and Nit findings do not block completion. See summary table and recommended follow-ups below.

---

## 1. End-to-End Delivery Traceability

**PM → Architect:** Design covers all acceptance criteria from the proposal: placement (resizable side panel), gate-aware default (A → proposal, B → design), refresh (manual + visibility), timestamps, summary cards (task progress + latest mtime), Open in Cursor (app-wide project + Specs-area copy folder/file path), agent activity (phase, task, current file). No out-of-scope additions.

**Architect → Developer:** Implementation matches the design: `http.ts` extends `/api/files/list` with `mtime`; `server.ts` adds `currentFile` in `buildFullDump()` and `devflo_set_agent_activity`; `state.ts` and client types include `currentFile`; `GET /api/project` added; App layout uses `ResizableSpecPanel` + `SpecsArea`; FileViewer removed from main content; SpecsArea has tabs, gate-aware default, refresh, visibility, timestamps, summary, copy path; ChangeHeader has Open in Cursor (project) and agent activity (phase, task, current file); DashboardContext fetches `/api/project` and exposes `projectPath` and `currentFile`. One justified deviation: SpecsArea gets state via `useDashboard()` instead of props (simpler, no prop drilling).

**Developer → Request:** Delivered behavior satisfies the PM brief: user can see OpenSpec docs in a dedicated Specs panel, get the right spec at gate time, read and approve in one view, refresh and see timestamps/summary, use Open in Cursor (project + copy paths), and see agent activity. No gaps for the in-scope behavior.

---

## 2. Acceptance Criteria Compliance

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | OpenSpec docs visible and easy to find | Met | Resizable right panel labeled "Specs"; proposal, design, tasks (and .openspec.yaml) in tabs. |
| 2 | Relevant spec at gate time | Met | `getDefaultFileIndex`: Gate A → proposal, Gate B → design; default applied on gate and initial load (see Minor #1 for refresh behavior). |
| 3 | Read and approve in one view | Met | Gate card in main content; Specs in side panel; both visible without scrolling. |
| 4 | All three artifacts accessible | Met | Tabs for proposal, design, tasks; content via existing `/api/files`. |
| 5 | Spec content up to date | Met | Manual Refresh button; `visibilitychange` refetches list and current file when tab visible. |
| 6 | Last-modified timestamps visible | Met | Per-file mtime in SpecsArea tabs; `formatRelativeTime`; from extended `/api/files/list`. |
| 7 | Summary cards present | Met | Task progress (completed/total) and latest spec mtime in Specs area header. |
| 8 | "Open in Cursor" available | Met | ChangeHeader: "Open in Cursor" (project via `vscode://file` or copy); SpecsArea: "Copy folder path" and per-file copy path. |
| 9 | Agent activity hinted | Met | ChangeHeader shows Phase, Task, and File when set; `currentFile` from state; `devflo_set_agent_activity` implemented. |
| 10 | No regression | Met | FileViewer removed from main content; single Specs area; App.test asserts no "Workspace Files" in main content. |

---

## 3. Test Coverage & Quality

**Unit (design):** List API mtime, state currentFile, project path.

- **http.test.ts:** Covers `/api/files/list` response shape with `name` and `mtime` (ISO), path traversal 403, missing `dir` 400; covers `GET /api/project` with `projectPath`. Sufficient and meaningful.
- **state.test.ts:** Covers `currentFile` round-trip in save/load and undefined when not set; other state tests unchanged. Sufficient.

**Integration (design):** Gate-aware tab, refresh, visibility, Open in Cursor.

- **App.test.tsx:** Covers Specs panel visibility when `workspacePath` set vs unset, and that main content does not contain FileViewer ("Workspace Files"). Does **not** cover: gate A/B default tab selection in SpecsArea, refresh updating content, visibility triggering refetch, or Open in Cursor behavior. Design’s integration bullets are only partially automated (see Minor #2).

**Regression:** Layout and single-spec-surface regression covered by App tests. No duplicate Specs area.

---

## 4. Code Quality & Maintainability

- **SRP:** HTTP handlers, state, server dump, MCP tools, and UI components have clear responsibilities. SpecsArea handles list, content, tabs, refresh, visibility, summary, and copy; could be split later if it grows but is under 800 lines.
- **File length:** All reviewed files under 800 lines.
- **DRY / patterns:** `formatRelativeTime` local to SpecsArea; could be shared with PhaseTimeline if desired (Nit). Context and types used consistently.
- **Clarity:** ResizableSpecPanel, SpecsArea, and ChangeHeader are readable. SpecPanelPlaceholder is unused (Minor #3).

---

## 5. Compatibility & Safety

- **API:** `/api/files/list` now returns `files: Array<{ name, mtime }>`. SpecsArea tolerates legacy `string` entries via `typeof f === "string" ? { name: f } : { name: f.name, mtime: f.mtime }`. Backward compatible.
- **GET /api/project:** New endpoint; optional for clients; returns `{ projectPath: string | null }`.
- **State:** Optional `currentFile`; omitted from dump when undefined or empty. Safe for old clients.
- **Error handling:** File list/content fetch failures yield empty list or "Could not load file"; project fetch failure sets `projectPath` to null. Acceptable.

---

## 6. Risk & Edge Cases

- **Security:** Path traversal and allowed extensions unchanged in http.ts. Project path exposure is intentional for Open in Cursor.
- **Performance:** No polling; refresh only on button and visibility. No concerns.
- **currentFile updates:** `devflo_set_agent_activity` does not broadcast an incremental message; dashboard gets `currentFile` on next full state. Design left incremental updates optional; acceptable.

---

## Findings

| # | Category | Severity | Fix Type | Location | Evidence | Expected | Action |
|---|----------|----------|----------|----------|----------|----------|--------|
| 1 | Bug Risk | Minor | Surgical | `src/mcp/ui/src/components/SpecsArea.tsx:99–103` | `useEffect([files, gate])` always sets `activeIndex` to `getDefaultFileIndex(files, gate)`. On Refresh, `files` gets a new reference and the effect runs, resetting the selected tab to the gate default and overwriting the user’s tab choice. | User’s tab selection should be preserved across Refresh; only clamp if index is out of bounds, and reset to gate default only when `gate` changes. | In the effect that depends on `[files, gate]`, only set to gate default when `gate` changes; when only `files` changes, do `setActiveIndex(prev => prev >= files.length ? getDefaultFileIndex(files, gate) : prev)`. Alternatively, set default only on initial load and on gate change, not on every files update. |
| 2 | Missing Test | Minor | Structural | Test strategy vs implementation | Design’s integration tests: gate A → proposal default tab, gate B → design default; Refresh updates content; visibility triggers refetch; Open in Cursor (app-wide and Specs-area). Only layout/regression (Specs panel visibility, no FileViewer) is covered by App.test.tsx. | Automated integration tests for gate-aware default, refresh, and Open in Cursor as per design. | Add integration tests (e.g. SpecsArea or App with mocked fetch/WS) for: default tab when gate A vs B; refresh updating list/content; visibility triggering refetch; Open in Cursor (project) and copy path behavior. Or document that these are covered manually. |
| 3 | Code Quality | Minor | Surgical | `src/mcp/ui/src/components/SpecPanelPlaceholder.tsx` | Component is never used; App uses SpecsArea inside ResizableSpecPanel. | No dead code in ship path. | Remove SpecPanelPlaceholder or use it as a loading/empty state inside SpecsArea if desired. |
| 4 | Code Quality | Nit | Surgical | `openspec/changes/dashboard-openspec-observability/tasks.md` (Task 10) | "Related AC: **11** (no regression)". Proposal has 10 expectation criteria; #10 is no regression. | Related AC: 10. | Change "11" to "10" in Task 10’s Related AC. |
| 5 | Code Quality | Nit | Optional | `src/mcp/ui/src/components/SpecsArea.tsx` | `formatRelativeTime` is local; PhaseTimeline has similar relative-time formatting. | Shared time-formatting utility if used in multiple components. | Consider extracting a shared `formatRelativeTime` (e.g. in a small util or reusing from PhaseTimeline) for consistency; optional. |

**Note:** FileViewer.tsx remains in the tree but is not referenced by App; design said "replaced by" SpecsArea. Removing it is a follow-up cleanup, not required for QA pass.

---

## Summary Table

| Severity | Count | Surgical | Structural |
|----------|-------|----------|------------|
| Blocker  | 0     | 0        | 0          |
| Major    | 0     | 0        | 0          |
| Minor    | 3     | 2        | 1          |
| Nit      | 2     | 1        | 0          |

---

## Developer Re-work (optional)

- **Surgical (recommended):**  
  1. **SpecsArea (tab on Refresh):** Adjust the `useEffect([files, gate])` so that when only `files` changes (e.g. after Refresh), preserve `activeIndex` unless it’s out of bounds; when `gate` changes, set `activeIndex` to `getDefaultFileIndex(files, gate)`.  
  2. **SpecPanelPlaceholder:** Delete the file or use it where appropriate.  
  3. **tasks.md:** Change Task 10 "Related AC: 11" to "Related AC: 10".

- **Structural (if desired):**  
  - Add integration tests for gate-aware default tab, refresh, visibility refetch, and Open in Cursor as in the design’s testing strategy.

---

**Confidence: HIGH**

All six verification areas were checked against the OpenSpec artifacts and the implemented code. Evidence is file- and line-specific. No Blockers or Majors; optional follow-ups are documented above.
