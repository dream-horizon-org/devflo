---
description: Resume an in-progress change from where it was last active
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
argument-hint: "[change-name]"
---

# Resume — Continue Change from Last Active Phase

Resume an in-progress AI SDLC change from where it was last active. The user will provide the change name as a parameter (e.g., `/devflo-resume add-user-auth`). If no parameter is provided, list all active (non-delivered, non-cancelled) changes and ask which one to resume.

## Steps

### 1. Validate Change Exists

1. If no change name was provided, list all directories under `openspec/changes/`. For each that contains a `status.yaml`, read it and display a one-line summary. Ask the user which change to resume. Stop here until they respond.
2. Read `openspec/changes/<change-name>/status.yaml`. If it does not exist, report: "No change workspace found for `<change-name>`. Run `/devflo-plan <request>` to start a new change." **Stop.**
3. If `phases.close.status` is `complete`, report: "Change `<change-name>` was already delivered on `<closed_at>`. Nothing to resume." **Stop.**
4. If the change was cancelled (all tasks cancelled, workspace archived), report: "Change `<change-name>` was cancelled. Start a new change with `/devflo-plan <request>`." **Stop.**

### 2. Resolve Resume Point

Use the phase statuses and `tasks_pending` to determine the correct entry point. Apply the first matching rule:

| # | Condition | Resume At |
|---|-----------|-----------|
| 1 | `tasks_pending` is non-empty AND `architect.status` == `approved` | Phase 3 — Implement (next pending task) |
| 2 | `test_summary.status` == `complete` | Phase 6 — Deliver/Cleanup |
| 3 | `qa.status` == `pass` AND `tasks_pending` is empty | Phase 5 — Test Summary |
| 4 | `qa.status` in [`in_progress`, `fail`] | Phase 4 — QA/Audit |
| 5 | `architect.status` == `approved` AND `tasks_pending` is empty | Phase 5 — Test Summary |
| 6 | `architect.status` in [`in_progress`, `complete`] | Phase 2 — Design / Gate B |
| 7 | `pm.status` == `approved` | Phase 2 — Design |
| 8 | `pm.status` in [`in_progress`, `complete`] | Phase 1 — PM / Gate A |
| 9 | `pm.status` == `pending` | Phase 1 — PM |

### 3. Display Resume Summary

Present a clear summary before re-entering the workflow:

```
> **[RESUME]** | Change: `<change-name>` | Classification: `<type>` | Pipeline: `<pipeline>`
>
> **Original request:** <original_request from status.yaml>
> **Last active phase:** Phase <last_active_phase> at <last_active_at>
> **Completed phases:** <list of phases with status approved/complete/pass>
> **Dev progress:** <tasks_completed count>/<total tasks> tasks completed
> **Pending gates:** <list any gates not yet passed>
> **Resuming at:** Phase <N> — <phase name>
```

### 4. Reconstruct Context

Read all existing artifacts for the resolved phase to rebuild the context that was in the original conversation:

| Resume Phase | Artifacts to Read |
|---|---|
| Phase 1 (PM) | `original_request` from `status.yaml` |
| Phase 1 / Gate A | `proposal.md` (present to user for approval) |
| Phase 2 (Design) | `proposal.md` |
| Phase 2 / Gate B | `design.md`, `tasks.md` (present to user for approval) |
| Phase 3 (Dev) | `proposal.md`, `design.md`, `tasks.md` |
| Phase 4 (QA) | `proposal.md`, `design.md`, `tasks.md` |
| Phase 5 (Test Summary) | `proposal.md`, `design.md`, `tasks.md` |
| Phase 6 (Deliver) | `proposal.md`, `design.md`, `tasks.md` |

### 5. Enter Resolved Phase

Based on the resolved resume point, take the appropriate action:

**Gate pending (PM complete but not approved):**
Present the `proposal.md` summary and ask the user to reply with **PM APPROVED**.

**Gate pending (Architect complete but not approved):**
Present the `design.md` and `tasks.md` summary and ask the user to reply with **ARCH APPROVED**.

**Phase 1 — PM (in_progress or pending):**
Invoke the **PM Agent** (`pm-agent` agent) with the `original_request` from `status.yaml`, the classification, the change workspace path, and instruction to read any existing `proposal.md` content (partial work may exist).

**Phase 2 — Design (in_progress):**
Invoke the **Architect Agent** (`architect-agent` agent) with the change workspace path, instruction to read `proposal.md`, and instruction to check for any existing `design.md` or `tasks.md` content before starting fresh.

**Phase 2 — Design (pm approved, architect pending):**
Invoke the **Architect Agent** normally — same as `/devflo-design`.

**Phase 3 — Implement:**
If `current_task` is set in `status.yaml` (task was interrupted mid-implementation):
1. Run the project test suite to assess the current code state.
2. Invoke the **Developer Agent** with the task details and a note that this is a **resumed task** — the agent should check for existing implementation before starting fresh.

If `current_task` is not set:
Auto-select the next pending task in dependency order from `tasks.md` and invoke the Developer Agent normally.

**Phase 4 — QA/Audit:**
If `qa.status` is `fail`: invoke the Developer Agent to fix outstanding issues, then re-invoke the QA Agent.
If `qa.status` is `in_progress`: re-invoke the QA Agent to complete the review.

**Phase 5 — Test Summary:**
Run the full test suite and produce the Test Summary. Proceed to Deliver.

**Phase 6 — Deliver/Cleanup:**
Execute the Deliver phase — produce the change summary, append to `DELIVERED.md`, update artifacts.

### 6. Continue Normal Workflow

After entering the resolved phase, follow the standard phase transition rules. Phase transitions are automatic — do NOT stop to ask permission (except at Gate A and Gate B).

### Artifact-Based Fallback

If `status.yaml` is missing or corrupted but the change workspace exists, fall back to artifact detection:

| Artifacts Present | Inferred Phase |
|---|---|
| `design.md` + `tasks.md` with tasks marked `done` | Phase 3+ (Dev in progress) |
| `design.md` + `tasks.md` (no done tasks) | Phase 3 (start of Dev) |
| `design.md` (no `tasks.md`) | Phase 2 (Architect incomplete) |
| `proposal.md` populated (no `design.md`) | Phase 1 complete / Phase 2 pending |
| `proposal.md` empty or stub | Phase 1 (PM incomplete) |
| No artifacts | Phase 1 (start) |

In fallback mode, reconstruct `status.yaml` from the detected state before proceeding.
