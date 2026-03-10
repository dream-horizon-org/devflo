# PM Brief: MCP Dashboard Refactor

## Restated Request

Refactor the MCP dashboard server to fix the dual-browser-window bug, add disk-persisted state, support multiple concurrent changes as tabs, ensure pending interactions survive WebSocket reconnects, add a tab-close warning with confirmation, and confirm project-level scoping is already satisfied. The server currently uses a single in-memory `dashState` and single `wsClient`, with a race condition in `ensureBrowserOpen()` that opens multiple browser windows when MCP tools are called rapidly.

## Confirmed Context

- **Current architecture**: `src/mcp/server.ts` holds single `dashState`, single `wsClient`, `ensureBrowserOpen()`, `waitForClientSend()`, and all MCP tool handlers. `src/mcp/launcher.ts` uses `open -na` on macOS (forces new instance). `src/mcp/ui` uses React context with single `DashboardState`.
- **Project-level scoping**: Already satisfied — each project runs its own MCP server on its own port. No changes needed.
- **Design decisions from prior conversation**:
  - State files at `{projectPath}/.cursor/mcp/state/{changeId}.json` with `manifest.json`
  - Each change state includes pending questions and gates
  - UI uses tabbed model: `AppState { tabs: Map<changeId, TabState>, activeTabId }`
  - Tab close shows warning; on confirm, server deletes state file
  - `ensureBrowserOpen()` only checks `!hasBrowserOpened()`, not client connection state
  - Remove `-n` flag from macOS `open` commands to reuse existing window

## Scope

- **Fix dual browser window bug**: Change `ensureBrowserOpen()` to only check `!hasBrowserOpened()` (remove `noClient` from condition). Remove `-n` flag from `open` commands in launcher so existing browser window is reused.
- **Disk-persisted state**: Persist ALL change state to `{projectPath}/.cursor/mcp/state/{changeId}.json`. Add `manifest.json` listing change IDs. Load state on server start; save on every state mutation. This includes pending questions and gate approvals — after a process restart they are shown in a stale/expired state (visible for context, but no longer answerable since the requesting agent session is dead).
- **Multi-change tab support**: Server `dashState` becomes `Map<changeId, ChangeState>`. Each change has its own phases, tasks, events, QA results, test summary, change context. UI shows tabs; each tab renders one change's state.
- **Pending interactions survive reconnect and restart**: Store pending questions and gate requests in change state, persisted to disk. On WebSocket connect, re-send pending interactions for all changes to the client. After a process restart, restored pending interactions are marked as stale/expired in the UI (user can see what was asked but cannot answer — the agent session no longer exists).
- **Tab close with warning**: UI shows confirmation dialog when user closes a tab. On confirm, client sends `tab_close` message; server deletes state file, removes from map, and cleans up.
- **Project-level scoping**: Document as already satisfied; no implementation changes.

## Out of Scope

- Supporting multiple concurrent active MCP sessions for different changes (orchestrator works on one change at a time; tabs show historical + current)
- Changing MCP tool signatures (changeId derived from `devflo_set_change_context` name; "active change" implicit from last set_change_context)
- Browser choice or window size preferences
- Offline mode or sync across devices

## Expectation Criteria

1. **Single browser window per project**: Rapid MCP tool calls (e.g., 5 within 1 second) open at most one browser window per project. Multiple projects may each have their own window. No duplicate windows within a single project.
2. **Full state persistence**: After server restart, ALL change state (phases, tasks, events, QA results, test summary, change context, answer history, pending questions, pending gates) is restored from disk. Pending questions/gates restored after restart are shown as stale/expired — visible for context but not answerable.
3. **Multi-tab UI**: Dashboard shows multiple tabs when multiple changes exist. Each tab displays its change's phases, tasks, events, QA results, test summary. User can switch tabs.
4. **Pending on reconnect**: If a pending question or gate exists and the browser disconnects then reconnects (same server process), the pending interaction is re-sent and appears in the UI, fully answerable. If the server process restarted, they appear as stale/expired with a visual indicator.
5. **Tab close warning**: Closing a tab shows a confirmation dialog: "Closing this tab will permanently delete its data. Continue?" On confirm, tab and its state are removed; state file deleted.
6. **Project scoping**: No regression; each project's dashboard remains isolated to its project path.

## Assumptions

- `changeId` equals the change name from `devflo_set_change_context` (kebab-case)
- Tab is created when `devflo_set_change_context` is first called for a change name
- `manifest.json` contains `{ changeIds: string[], activeTabId?: string }` for restore
- Orchestrator calls `devflo_set_change_context` at the start of each change; all subsequent tool calls apply to that "active" change until the next `set_change_context`
- All data including pending interactions is persisted to disk; after process restart, pending interactions are marked stale since the agent session is gone
- WebSocket remains single client; server broadcasts to that client for all tabs (client receives full state for all changes on connect)
- Reconnect message format (full dump vs per-tab messages) is deferred to Architect to decide

## Risk Flags

- **State file corruption**: JSON write failures or partial writes could corrupt state. Mitigation: atomic write (write to temp, then rename).
- **Large manifest**: Many changes could make manifest and initial load slow. Mitigation: defer to Architect for pagination or lazy-load if needed.
- **Tab close during pending interaction**: If user closes tab while a question/gate is pending, the MCP call will timeout. Acceptable — user chose to close.
