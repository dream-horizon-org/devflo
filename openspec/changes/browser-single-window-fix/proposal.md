# Browser Single-Window Fix

## Problem

Each Cursor session spawns its own MCP server process (`devflo mcp-serve`) which starts its own HTTP/WebSocket server on a different port. Each process independently opens a new browser window. When multiple Cursor sessions are open for the same project, this results in multiple browser windows instead of one unified dashboard.

Additionally, three code-level bugs prevent the system from working even in single-session scenarios:
1. `readPortFile()` always returns `null` (both ternary branches return `null`).
2. `manifestPath()` calls itself recursively instead of `stateDir()`, causing infinite recursion.
3. `removeLocalMcpConfig()` references an undefined `projectPath` variable instead of the `projectDir` parameter.

## Expected Behavior

- **One browser window per project**, regardless of how many Cursor sessions are open.
- Each Cursor session's changes appear as **tabs within that single browser window**.
- If the browser window is already open, the system does not open another one.
- Multiple browser clients (tabs/windows) connecting to the same dashboard server all receive updates.

## Reproduction Steps

1. Open a project in Cursor. The MCP server starts.
2. Start an AI SDLC workflow (e.g., request a new feature). The agent calls MCP tools (`devflo_set_change_context`, `devflo_update_phase`, `devflo_ask_user`, etc.).
3. Each MCP tool call triggers `ensureBrowserOpen()`. Because the `browserOpened` flag is set asynchronously (in the `exec` callback) and/or gets reset when the WebSocket connection closes during page load, multiple calls see the flag as `false` and each opens a **new browser window**.
4. Observe: multiple browser windows open for the same dashboard, one for each MCP tool invocation that raced or followed a WebSocket close.

## Acceptance Criteria

- Exactly **one browser window** opens per project per MCP server lifecycle, regardless of how many MCP tool calls the agent makes.
- The `browserOpened` flag is set **synchronously** before the async `exec` call, preventing race conditions between rapid MCP tool invocations.
- WebSocket close events no longer reset `browserOpened` to `false` (a brief disconnection during page load must not trigger a new browser window).
- The macOS `open` command no longer uses `-n` (new instance) when a dashboard is already open; it reuses the existing window.
- Multiple browser WebSocket clients are supported simultaneously (replacing the single `wsClient` variable with a `Set<WebSocket>`).
- The three code-level bugs (`readPortFile`, `manifestPath`, `removeLocalMcpConfig`) are fixed.
- For multi-session (two Cursor windows on the same project): the second MCP server detects the first server is already running and connects to it as a secondary, rather than starting its own dashboard server and opening another browser.
