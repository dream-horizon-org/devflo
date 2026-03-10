# PM Brief: Dashboard OpenSpec Observability

## Restated Request

Improve observability of what is happening inside Cursor during the SDLC so the user can review OpenSpec documentation (proposal, design, tasks) and give approvals from the dashboard without constant to-and-fro to Cursor. The enhancement should (1) surface OpenSpec docs clearly in the dashboard, (2) show the right spec at the right time (e.g. proposal at Gate A, design at Gate B), (3) use an intuitive layout—e.g. a side panel or dedicated area—so reading specs and approving gates happens in one place, and (4) add live observability: auto-refresh of spec content, last-modified timestamps, summary cards (e.g. AC count, task progress), an "Open in Cursor" link, and a hint of agent activity (e.g. current phase/task or file). Specs remain read-only in the dashboard; no in-dashboard editing.

## Confirmed Context

- **Dashboard today**: MCP-driven React/Vite app in `src/mcp/ui` showing SDLC state: phases, tasks, activity log, QA results, test summary, change context (name, classification, pipeline, workspacePath). OpenSpec change workspaces live under `openspec/changes/<change-name>/` with `proposal.md`, `design.md`, `tasks.md`.
- **Existing FileViewer**: A "Workspace Files" section already lists and renders `proposal.md`, `design.md`, `tasks.md` (and `.openspec.yaml`) when `state.changeContext?.workspacePath` is set. Content is fetched via HTTP API (`/api/files/list`, `/api/files?path=`) and displayed in a collapsible block with tabs; markdown is rendered. It appears inline in the main content area, below the gate card when present.
- **User pain**: Having to switch to Cursor to read the spec and then return to the dashboard to approve creates friction; OpenSpec docs should be visible and contextual on the dashboard so approvals can be given with full context in one place.

## Scope

- **OpenSpec visibility and placement**: Provide a clear, persistent way to view OpenSpec documentation (proposal, design, tasks) on the dashboard. Options to be decided in design: e.g. a resizable side panel so the user can read specs alongside the main content (gate card, tasks, QA) without scrolling away, or an elevated inline area with phase-aware default selection.
- **Phase/gate-aware spec surfacing**: When a gate is pending, surface the relevant artifact by default—e.g. at Gate A (PM Approval) show or highlight proposal; at Gate B (Architect Approval) show or highlight design—so the user does not have to hunt for the right tab. Full access to all three artifacts (proposal, design, tasks) remains available.
- **Intuitive UI/UX**: Layout and labeling should make it obvious where to read specs and how to approve; minimize cognitive load when moving from "read proposal" to "click PM APPROVED." Design phase will specify exact placement (side panel vs dedicated tab vs elevated inline), default expansion, and any contextual hints (e.g. "Review proposal below before approving" near Gate A).
- **Auto-refresh / live sync of spec content**: Keep spec content shown in the dashboard up to date when the agent (or user in Cursor) updates proposal/design/tasks. **Confirmed:** manual "Refresh" button plus refresh when the user focuses the dashboard (browser tab); no polling.
- **Last-modified timestamps**: Display when each spec file (proposal, design, tasks) was last modified (e.g. "Updated 2 min ago" or absolute time) so the user knows if content may have changed since they last looked.
- **Summary cards**: Compact, at-a-glance view of key metrics for the change. **Confirmed:** Architect decides exact metrics within "at-a-glance metrics for the change" (e.g. AC count, task progress, last-modified, word count).
- **"Open in Cursor" link**: A button or link that lets the user open the spec (or change workspace) in Cursor. **Confirmed:** Architect decides behavior (e.g. open specific file vs open folder vs copy path, or combination).
- **Agent activity**: A hint of what the agent is currently doing. **Confirmed:** both current phase + current task and current file when available. May require new MCP or server support.

- **Editing specs from the dashboard**: Specs are read-only in the dashboard; no in-dashboard editing of proposal, design, or tasks. Users who need to edit must use "Open in Cursor" or switch to Cursor.

- **Changing MCP/server beyond what’s needed**: New endpoints or MCP tools only where necessary for agent activity or timestamps; scope of API changes to be defined in design.

## Expectation Criteria

1. **OpenSpec docs are visible and easy to find**: User can open the dashboard and, for the active change, see where to read proposal, design, and tasks without switching to Cursor. The location (side panel, dedicated tab, or elevated inline) is clearly labeled (e.g. "OpenSpec" or "Specs").
2. **Relevant spec at gate time**: When Gate A (PM Approval) is pending, the proposal is surfaced by default (e.g. selected tab or default document in the spec area). When Gate B (Architect Approval) is pending, the design is surfaced by default. User can still switch to any other spec document.
3. **Read and approve in one view**: User can read the surfaced spec and use the gate approval card (PM APPROVED / ARCH APPROVED or revise) without scrolling the spec out of view, or with minimal scrolling, depending on the chosen layout (e.g. side panel keeps both visible).
4. **All three artifacts accessible**: Proposal, design, and tasks remain available from the dashboard (same content as today’s FileViewer); only placement and default selection are enhanced.
5. **Spec content stays up to date (auto-refresh)**: Spec content updates via a manual "Refresh" button and/or when the user focuses the dashboard tab (no full page reload). No polling required.
6. **Last-modified timestamps visible**: Each spec file (proposal, design, tasks) in the spec area displays when it was last modified (relative e.g. "2 min ago" or absolute time), so the user can tell if content may have changed.
7. **Summary cards present**: At least one summary card or compact summary is visible (e.g. in the spec area or change header) with at-a-glance metrics for the change; exact metrics as defined by the Architect.
8. **"Open in Cursor" available**: User can trigger an action (button or link) that opens the spec or change workspace in Cursor (or copies path); behavior (open file vs folder vs copy path) as defined by the Architect.
9. **Agent activity hinted**: The dashboard shows current phase + current task and current file when available; if backend support is required, it is implemented or stubbed as agreed in design.
10. **No regression**: Existing behavior (questions, gate actions, tasks, QA, test summary, activity log, tabs) continues to work. FileViewer behavior may be refactored or replaced by the new spec area but the ability to read full proposal/design/tasks from the dashboard is preserved or improved.

## Assumptions

- **Placement**: If the user does not specify a preference, the Architect will choose among: (a) resizable side panel for OpenSpec beside main content, (b) dedicated "Specs" tab or sub-view, (c) elevated inline section (current FileViewer moved up and expanded by default with phase-aware default tab). PM assumes (a) or (c) best supports "read and approve in one place."
- **Phase/gate mapping**: Gate A → proposal, Gate B → design; tasks are available anytime. If `gatePending` is absent, default to proposal as the first document.
- **workspacePath**: Already provided in `change_context`; file listing and content use the existing HTTP file API scoped to `projectPath`; new endpoints only if needed for timestamps or agent activity.
- **Single change per tab**: Each tab is one change; the spec area shows the OpenSpec workspace for the active tab’s change (existing behavior).
- **Auto-refresh (confirmed)**: Manual "Refresh" button plus refresh when the user focuses the dashboard (browser tab). No polling.
- **Agent activity (confirmed)**: Both current phase + current task and current file when available.
- **Summary cards (confirmed)**: Architect decides exact metrics (at-a-glance metrics for the change).
- **Open in Cursor (confirmed)**: Architect decides behavior (open file vs folder vs copy path or combination).
- **Priority/phasing (confirmed)**: Single release; ship everything together.

## Deferred (not in this change)

- **In-dashboard editing of specs**: Editing proposal/design/tasks from the dashboard is out of scope; read-only only. Any future editing UX would be a separate change.
- **Richer agent telemetry**: Deeper agent state (e.g. streaming edits, per-file diff preview) is out of scope; this change limits agent activity to a concise hint (phase/task or file or "working").

## Risk Flags

- **Layout complexity**: Adding a side panel or a new tab changes the dashboard layout; responsive behavior and small-screen use should be considered in design to avoid a cramped or broken UI.
- **Duplicate behavior**: Existing FileViewer already shows the same files; refactoring or replacing it must preserve or improve discoverability and avoid two competing "spec" areas.
- **Auto-refresh complexity**: Refresh on tab focus and manual button are lower risk than polling; implementation should avoid unnecessary refetches when tab is not focused.
- **Agent-activity API**: If agent activity requires new MCP tools or server endpoints to report current phase/task/file, that increases scope and integration risk; design should clarify whether existing state (e.g. phases/tasks from current dashboard state) is sufficient or new reporting is needed.
