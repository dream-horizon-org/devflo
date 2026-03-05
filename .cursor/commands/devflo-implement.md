# Implement — Build with TDD

You are the orchestrator for the implementation phase of the AI SDLC. The user will provide the change name and optionally a task number as parameters (e.g., `/devflo-implement add-user-auth 1` or `/devflo-implement add-user-auth`).

## Steps

### 1. Validate Prerequisites

1. Read `openspec/changes/<change-name>/status.yaml`.
2. Verify that `phases.architect.status` is `approved`.
3. Verify that `openspec/changes/<change-name>/design.md` and `tasks.md` exist and are populated.

**Special case — Trivial classification:** If `status.yaml` shows classification as `Trivial`, the Architect phase is not required. Verify only that the change workspace exists. The Developer may proceed without a formal task list — the change itself is the single task.

If any prerequisite fails:

- If Architect phase hasn't run, suggest: "Run `/devflo-design <change-name>` first."
- If Architect phase is complete but not approved, ask the user to reply with **ARCH APPROVED**.
- Explain what's missing and **stop — do not proceed**.

### 2. Select Task

If the user provided a task number, use that task. Verify it exists in `tasks.md` and its status is `pending`.

If no task number was provided:

- Read `tasks.md` and resolve the dependency graph.
- **Auto-select the next task(s) in dependency order.** Pick tasks whose dependencies are all completed. If multiple tasks are independent (no dependencies on each other), they may be executed in parallel or sequentially — use judgment based on whether they touch overlapping files.
- **Do NOT ask the user to choose a task.** Proceed immediately with the auto-selected task(s).

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
- Instruction to follow TDD per the Developer Agent's classification-aware policy (strict TDD for bugs/small changes; iterative TDD permitted for new feature interface discovery)
- Instruction to update the task status in `tasks.md` to `done` when complete
- Instruction to report any out-of-scope issues discovered during implementation

Wait for the Developer Agent to complete its work.

### 5. Update State

After the Developer Agent finishes, update `status.yaml`:

- Move the task number from `tasks_pending` to `tasks_completed`
- Remove `current_task`

### 6. Next Steps — Automatic Advancement

- If more tasks remain: **Immediately loop back to Step 2** and auto-select the next task(s) in dependency order. Do NOT stop to ask the user.
- If all tasks are done: **Immediately proceed to the Audit phase** — invoke `/devflo-audit <change-name>` behavior (validate prerequisites, invoke QA Agent).

**Do NOT stop and ask for permission. Phase transitions are automatic.**
