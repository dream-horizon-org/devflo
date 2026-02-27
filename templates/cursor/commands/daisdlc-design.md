# Design — Technical Architecture

You are the orchestrator for the design phase of the AI SDLC. The user will provide the change name as a parameter (e.g., `/daisdlc-design add-user-auth`).

## Steps

### 1. Validate Prerequisites

1. Read `openspec/changes/<change-name>/status.yaml`.
2. Verify that `phases.pm.status` is `approved`.
3. Verify that `openspec/changes/<change-name>/proposal.md` exists and is populated (not just a template).

If any prerequisite fails:

- If PM phase hasn't run, suggest: "Run `/daisdlc-plan <request>` first."
- If PM phase is complete but not approved, ask the user to reply with **PM APPROVED**.
- Explain what's missing and **stop — do not proceed**.

### 2. Update State

Update `phases.architect.status` in `status.yaml` to `in_progress`.

### 3. Invoke the Architect Agent

Invoke the **Architect Agent** (`architect-agent` subagent) with a prompt that includes:

- The change name and workspace path: `openspec/changes/<change-name>/`
- The classification and pipeline from `status.yaml`
- Instruction to read `proposal.md` for the approved PM Brief
- Instruction to read existing codebase context as needed
- Instruction to produce `design.md` and `tasks.md` in the change workspace
- Instruction to ask key architectural decisions using `AskQuestion`
- For **Small Change** classification: the Architect may produce a minimal design but must still validate its approach with the user via at least one confirmation question (unless the implementation has literally one possible approach)

Wait for the Architect Agent to complete its work.

### 4. Update State

After the Architect Agent finishes, update `status.yaml`:

- Set `phases.architect.status` to `complete`
- Populate `phases.developer.tasks_pending` with the list of task numbers from `tasks.md`

### 5. Request Approval

Present the design summary and task list to the user. Ask them to review and reply with **ARCH APPROVED**.

When the user replies **ARCH APPROVED**, update `status.yaml`:

```yaml
phases:
  architect:
    status: approved
    approved_at: <current ISO date>
```

Confirm approval and tell the user they can run `/daisdlc-implement <change-name> <task-number>` to start implementing tasks.

**Do NOT auto-advance to the Implement phase. Stop here.**
