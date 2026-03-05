# Status — Check Change Progress

Report the current status of an AI SDLC change. The user may provide a change name as a parameter (e.g., `/devflo-status add-user-auth`). If no parameter is provided, list all changes.

## For a Specific Change

1. Read `openspec/changes/<change-name>/status.yaml`.
2. Present a clear summary:

```
Change: <change-name>
Classification: <classification>
Pipeline: <pipeline>
Created: <created_at>

Phase Status:
  Plan:         <status>
  Design:       <status>
  Implement:    Tasks completed: <X>/<Y total>
  Audit:        <status>
  Test Summary: <status>
  Deliver:      <status>
```

3. Based on the current state, suggest the **next command** the user should run. For example:
   - If Plan is `complete` but not `approved`: "Reply with **PM APPROVED**, then run `/devflo-design <change-name>`."
   - If Design is `approved`: "Run `/devflo-implement <change-name> <next-pending-task>` to start implementation."
   - If Audit is `pass`: "Run `/devflo-deliver <change-name>` to finalize."

## For All Changes

If no change name is provided:

1. List all directories under `openspec/changes/`.
2. For each directory that contains a `status.yaml`, read it and display a one-line summary:

```
<change-name>  |  <classification>  |  Current phase: <phase>  |  <status>
```

3. If no changes exist, tell the user: "No active changes found. Run `/devflo-plan <request>` to start a new change."
