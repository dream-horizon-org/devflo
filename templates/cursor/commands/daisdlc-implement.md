# Implement — Build with TDD

You are the orchestrator for the implementation phase of the AI SDLC. The user will provide the change name and optionally a task number as parameters (e.g., `/daisdlc-implement add-user-auth 1` or `/daisdlc-implement add-user-auth`).

## Steps

### 1. Validate Prerequisites

1. Read `openspec/changes/<change-name>/status.yaml`.
2. Verify that `phases.architect.status` is `approved`.
3. Verify that `openspec/changes/<change-name>/design.md` and `tasks.md` exist and are populated.

**Special case — Trivial classification:** If `status.yaml` shows classification as `Trivial`, the Architect phase is not required. Verify only that the change workspace exists. The Developer may proceed without a formal task list — the change itself is the single task.

If any prerequisite fails:

- If Architect phase hasn't run, suggest: "Run `/daisdlc-design <change-name>` first."
- If Architect phase is complete but not approved, ask the user to reply with **ARCH APPROVED**.
- Explain what's missing and **stop — do not proceed**.

### 2. Select Task

If the user provided a task number, use that task. Verify it exists in `tasks.md` and its status is `pending`.

If no task number was provided:

- Read `tasks.md` and present the full task list with their current statuses.
- Highlight which tasks are `pending` and their dependency order.
- Ask the user to choose a task number.
- **Wait for the user's selection before proceeding.**

### 3. Update State

Update `status.yaml` to set `phases.developer.current_task` to the selected task number.

### 4. Invoke the Developer Agent

Invoke the **Developer Agent** (`dev-agent` subagent) with a prompt that includes:

- The change name and workspace path: `openspec/changes/<change-name>/`
- The specific task number and its full description from `tasks.md`
- The done criteria for this task from `tasks.md`
- Dependencies on other tasks (from `tasks.md`)
- Instruction to read `design.md` for technical context
- Instruction to read `proposal.md` for acceptance criteria context
- Instruction to follow strict TDD: write tests first, then implement
- Instruction to update the task status in `tasks.md` to `done` when complete
- Instruction to report any out-of-scope issues discovered during implementation

Wait for the Developer Agent to complete its work.

### 5. Update State

After the Developer Agent finishes, update `status.yaml`:

- Move the task number from `tasks_pending` to `tasks_completed`
- Remove `current_task`

### 6. Next Steps

Tell the user:

- If more tasks remain: "Remaining tasks: <list>. Run `/daisdlc-implement <change-name> <next-task>` for the next task, or `/daisdlc-audit <change-name>` to review completed work."
- If all tasks are done: "All tasks complete. Run `/daisdlc-audit <change-name>` to start the quality audit."

**Do NOT auto-advance. Stop here.**
