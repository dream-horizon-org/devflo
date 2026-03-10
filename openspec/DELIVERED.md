# Delivered Changes

## MCP Dashboard Refactor

- **Date**: 2026-03-10
- **Classification**: Major Refactor
- **Pipeline**: Full (0→1→2→3→4→5→6)
- **Summary**: Transformed the MCP dashboard from a single-change, in-memory model to a multi-tab, disk-persisted architecture. Fixed the dual browser window bug caused by a race condition in `ensureBrowserOpen()` and macOS `open -na` forcing new instances. Added disk-backed state persistence with atomic writes and a cap+archive policy (max 20 active changes). Refactored the server to support multiple concurrent changes keyed by changeId, with full state dumps on WebSocket reconnect. Built a tabbed UI with per-change state isolation, tab close with confirmation dialog, and stale indicators for expired pending interactions after server restart.
- **Tasks completed**:
  - Fix dual browser window bug (launcher + ensureBrowserOpen)
  - Create state persistence module (src/mcp/state.ts)
  - Server: multi-change state structure and load on start
  - Server: route MCP tools to active change and persist
  - Server: pending interactions with stale handling
  - Server: WebSocket full dump, tab_close, set_active_tab
  - UI: add types for multi-tab state
  - UI: refactor DashboardContext for multi-tab state
  - UI: tab bar and active tab switching
  - UI: components read from active tab
  - UI: tab close with confirmation
  - UI: stale indicator for pending interactions
  - Integration verification and test summary
- **Test summary**: 1 suite, 11 tests, all passing. Build clean. No lint errors.
- **Breaking changes**: WebSocket protocol changed — `state` message now sends `{ tabs, activeTabId }` instead of flat fields. All per-change messages include `changeId`. Clients must be updated to handle the new multi-tab format.
- **Workspace**: `openspec/changes/mcp-dashboard-refactor/`

## Browser Single-Window Fix

- **Date**: 2026-03-10
- **Classification**: Bug Fix
- **Pipeline**: 0→1(PM lite)→3→4→5→6
- **Summary**: Fixed the browser opening bug where every MCP tool call opened a new browser window. Root causes: `browserOpened` flag was set asynchronously in the `exec` callback (race condition), WebSocket close events reset the flag, and macOS `open -n` forced new Chrome instances. Also added multi-session support via a primary/secondary MCP server pattern — the first process hosts the dashboard, subsequent processes relay through it. Replaced single `wsClient` with `Set<WebSocket>` for multi-client support.
- **Tasks completed**:
  - Fix browser opening race condition (set `browserOpened` synchronously before exec)
  - Remove `-n` flag from macOS `open` commands
  - Stop WebSocket close from resetting `browserOpened`
  - Replace single `wsClient` with `Set<WebSocket>` for multi-client broadcast
  - Add `/health` HTTP endpoint for server liveness detection
  - Add `isDevfloServerAlive()` health check utility
  - Implement primary/secondary MCP server pattern with internal WebSocket relay
  - Route answers/gate actions from browser back to correct secondary
- **Test summary**: 2 suites, 22 tests, all passing. TypeScript clean. No lint errors.
- **Breaking changes**: None
- **Workspace**: `openspec/changes/browser-single-window-fix/`

## Dashboard OpenSpec Observability

- **Date**: 2026-03-10
- **Classification**: New Feature
- **Pipeline**: Full (0→1→2→3→4→5→6)
- **Summary**: Improved observability of the SDLC on the DevFlo dashboard: OpenSpec docs (proposal, design, tasks) are shown in a resizable side panel with phase/gate-aware default tab (proposal at Gate A, design at Gate B). Added manual Refresh and refresh-on-dashboard-tab-focus, last-modified timestamps per spec file, summary cards (task progress + latest spec mtime), app-wide "Open in Cursor" button (project root) and Specs-area copy folder/file path, and agent activity (phase, task, current file). Single Specs surface; inline FileViewer removed. Specs remain read-only.
- **Tasks completed**: Extend file list API (mtime); agent-activity state + MCP (currentFile); dashboard layout + Specs panel; Specs area content/tabs/gate-aware default; Refresh + visibility refetch; last-modified timestamps; summary cards; Open in Cursor (app-wide + Specs area); agent activity display; regression verification.
- **Test summary**: `npm test -- --run`. Suites: 2 (http.test.ts, state.test.ts). Total: 19. Passed: 19. Failed: 0. Skipped: 0. Integration: no cross-task failures; single Specs area and API contracts verified.
- **Breaking changes**: None. `/api/files/list` response shape extended to `files: Array<{ name, mtime? }>`; existing FileViewer already updated to consume it. New optional `GET /api/project`, optional state field `currentFile`, new MCP tool `devflo_set_agent_activity`.
- **Workspace**: `openspec/changes/dashboard-openspec-observability/`
