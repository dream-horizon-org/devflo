# PM Brief: Dashboard Data Consistency Fix

## Restated Request

Fix all identified data inconsistencies and UX gaps in the MCP dashboard flow: session not restored after closing the browser, activeTabId pointing to missing tabs, lack of refresh/reload, slow or unclear real-time behavior, phase/tab state inconsistency between primary and secondary, and unclear feedback when something goes wrong.

## Confirmed Context

- **Current architecture**: Primary MCP server holds in-memory `changeStates` and sends a full dump on WebSocket connect. Secondary MCP processes relay incremental messages to the primary for broadcast but do not update the primary's state. State is persisted to disk per mutation; `loadState()` runs only at primary startup. Manifest can reference change IDs whose files are missing; `activeTabId` is not validated against loaded tabs on server or client.
- **Existing refactor**: `mcp-dashboard-refactor` delivered disk persistence, multi-tab UI, and single-window fix. This change addresses follow-on consistency and UX issues discovered in use.

## Problem Summary

| # | Problem | User impact |
|---|--------|-------------|
| 1 | Primary never applies relayed updates; full dump is primary-only | Session appears lost after closing browser when the active Cursor window was a secondary |
| 2 | Manifest not repaired when a change file is missing; client accepts invalid activeTabId | Blank/waiting UI with no explanation |
| 3 | Full state only on connect; no re-load from disk on connect | Reconnecting client cannot get latest persisted state |
| 4 | No indication when server is waiting for a client; background tab throttling; no "last update" | Feels slow or stuck; unclear if data is current |
| 5 | Two sources of truth (primary memory vs secondary + disk) | "What's going on" can be wrong after reconnect |
| 6 | No messaging when session failed to load or data may be stale | User doesn't know recovery is needed |
| 7 | Tab selection correct but content can be wrong (same as 1/5) | Confusion about project status |

## Scope

- **In scope**
  - Primary applies relayed updates to its in-memory state (and persists) so full dump is authoritative after reconnect.
  - Repair manifest in `loadState()` when a change file is missing; normalize `activeTabId` to a valid tab (or null).
  - Optionally re-load state from disk when a browser client connects (or rely on primary-apply-relay as source of truth; design to choose).
  - Client: validate/correct `activeTabId` when it is not in `tabs` (fallback to first tab or null).
  - UI: show explicit "Session could not be loaded" / "Data may be outdated" when appropriate; optional "Reload session" control.
  - UX: optional "last update" or connection/sync indicator to improve perceived real-time and debuggability.
- **Out of scope**
  - Changing MCP tool signatures or OpenSpec workflow phases.
  - Supporting multiple concurrent browser windows or offline sync.
  - Changing browser choice or window behavior beyond existing single-window fix.

## Expectation Criteria

1. **Session survives browser close**: After closing and reopening the dashboard, the same session (phases, tasks, events, active tab) is visible when the workflow was driven by either the primary or a secondary MCP process.
2. **No invalid activeTabId**: Server never sends `activeTabId` that is not in `tabs`; client normalizes if it receives one. No blank "waiting" state due to missing tab.
3. **Single source of truth**: Primary's in-memory state (and thus full dump) reflects all updates from both primary and secondary; disk is updated by whichever process mutates.
4. **Clear failure/stale feedback**: When state cannot be loaded or is known stale, the UI shows a clear message and, where applicable, a reload or re-sync action.
5. **Improved real-time clarity**: Users can tell when the server is waiting for a client (if feasible without new protocol) and/or when the last update was received (e.g. "Last update: just now" or timestamp).

## Dependencies

- Builds on `mcp-dashboard-refactor` (state persistence, multi-tab UI, WebSocket protocol).

## Out of Scope

- Multiple concurrent active MCP sessions; browser/window preferences; offline or cross-device sync.
