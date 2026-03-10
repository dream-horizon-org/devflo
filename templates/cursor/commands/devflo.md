# Run Full AI SDLC

You are the orchestrator for the complete AI Software Development Lifecycle. The user will provide a request description as a parameter (e.g., `/devflo Add user authentication with OAuth2`).

This command drives the full lifecycle from classification through delivery — the same pipeline defined in the AI SDLC workflow rule, enforced explicitly as a command.

---

## Phase 0 — Task Classification + Pipeline Selection

Phase 0 is a **routing decision only**. It must NOT analyze the codebase, suggest solutions, or produce any output beyond the prescribed format.

### Classify the request:

| Classification | Definition |
|----------------|-----------|
| **Trivial** | Scope, design, and acceptance criteria are all self-evident. A senior engineer would merge without discussion. |
| **Bug Fix** | Incorrect behavior with a clear expected outcome. |
| **Small Change** | Localized enhancement with obvious scope. No architectural decisions. |
| **New Feature** | New capability that requires requirements gathering and design. |
| **Major Refactor** | Structural change spanning multiple modules or layers. |

### Select the pipeline:

| Classification | Pipeline | Gates |
|----------------|----------|-------|
| **Trivial** | Phase 0 → Implement → Audit (lightweight) → Deliver | None |
| **Bug Fix** | Phase 0 → Plan (lite) → Implement → Audit → Test Summary → Deliver | Gate A |
| **Small Change** | Phase 0 → Plan → Design → Implement → Audit → Test Summary → Deliver | Gate A, Gate B |
| **New Feature** | Full pipeline, all phases, all gates | Gate A, Gate B |
| **Major Refactor** | Full pipeline, all phases, all gates | Gate A, Gate B |

### Emit the classification:

```
> **[Phase 0 — Classification]** | Request: "<one-sentence summary>"

**Classification:** <type>
**Reasoning:** <one sentence>
**Pipeline:** <pipeline>
**Next:** Proceeding to Phase <X>.
```

---

## Spec Drift Check (Pre-Plan, non-Trivial only)

If `openspec/spec.md` exists, scan it for references to modules, APIs, or behaviors that no longer exist in the codebase. If drift is detected, surface it to the user before proceeding. The user may choose to fix the spec first, proceed with awareness, or defer.

---

## Initialize OpenSpec Change Workspace

1. Derive a kebab-case change name from the request.
2. Ensure `openspec/` exists. If not, run: `devflo spec init --tools none`
3. Create the change workspace: `devflo spec change create <change-name>`
4. Generate templates: `devflo spec change generate-templates <change-name>`
5. Create `openspec/changes/<change-name>/status.yaml`:

```yaml
change_name: <change-name>
classification: <classification>
pipeline: <pipeline>
created_at: <current ISO date>
phases:
  pm:
    status: pending
  architect:
    status: pending
  developer:
    tasks_completed: []
    tasks_pending: []
  qa:
    status: pending
  test_summary:
    status: pending
  close:
    status: pending
```

---

## Plan Phase (skip for Trivial)

> **[Plan]** | Change: `<change-name>` | Classification: `<type>` | Pipeline: `<pipeline>`

Update `phases.pm.status` in `status.yaml` to `in_progress`.

Invoke the **PM Agent** (`pm-agent` subagent) with:

- The user's original request
- The classification (use **PM Lite** mode for Bug Fix, **Full PM** for all others)
- The change workspace path: `openspec/changes/<change-name>/`
- Instruction to read existing OpenSpec specs if they exist
- Instruction to populate `proposal.md` with the PM Brief

After the PM Agent completes, update `phases.pm.status` to `complete`.

### Gate A — PM Approval

**Stop and ask the user to review the proposal.** Continue **only** when the user replies exactly: **PM APPROVED**

When approved, update `status.yaml`:

```yaml
phases:
  pm:
    status: approved
    approved_at: <current ISO date>
```

If the user replies **PM REVISE** (with or without additional text):
- If additional text accompanies the command → treat it as revision feedback. Re-invoke the PM Agent in **Revision mode** with that feedback. The PM must apply the feedback to the existing proposal without re-running the full question flow.
- If no additional text → prompt the user: "Please describe what should change." Treat their next message as revision feedback and re-invoke the PM Agent in **Revision mode**.

If the user does not approve or revise, wait. Do not proceed without explicit action.

---

## Design Phase (skip for Trivial and Bug Fix)

> **[Design]** | Change: `<change-name>` | Classification: `<type>` | Pipeline: `<pipeline>`

Update `phases.architect.status` in `status.yaml` to `in_progress`.

Invoke the **Architect Agent** (`architect-agent` subagent) with:

- The change name and workspace path
- The classification and pipeline
- Instruction to read `proposal.md` for the approved PM Brief
- Instruction to explore the codebase as needed
- **MANDATORY instruction: The Architect MUST use the `devflo_ask_user` MCP tool to ask the user at least one architectural or implementation approach question BEFORE writing the full design.** For New Feature and Major Refactor, the Architect must ask about key trade-offs (technology choices, data model decisions, API design alternatives). Skipping questions is only acceptable when the implementation has literally one possible approach with zero alternatives.
- **MANDATORY instruction: design.md must NOT contain implementation code, method bodies, pseudocode, or copy-pasteable code blocks.** Interfaces should be described in prose (method names, signatures, behavioral contracts) — not implemented.
- Instruction to produce `design.md` and `tasks.md` in the change workspace

After the Architect Agent completes, update `status.yaml`:
- Set `phases.architect.status` to `complete`
- Populate `phases.developer.tasks_pending` with task numbers from `tasks.md`

### Gate B — Architect Approval

**Stop and ask the user to review the design and tasks.** Continue **only** when the user replies exactly: **ARCH APPROVED**

When approved, update `status.yaml`:

```yaml
phases:
  architect:
    status: approved
    approved_at: <current ISO date>
```

If the user replies **ARCH REVISE** (with or without additional text):
- If additional text accompanies the command → treat it as revision feedback. Re-invoke the Architect Agent in **Revision mode** with that feedback. The Architect must apply the feedback to the existing design without re-running the full question flow.
- If no additional text → prompt the user: "Please describe what should change." Treat their next message as revision feedback and re-invoke the Architect Agent in **Revision mode**.

If the user does not approve or revise, wait. Do not proceed without explicit action.

---

## Implement Phase

> **[Implement]** | Change: `<change-name>` | Classification: `<type>` | Pipeline: `<pipeline>`

### Task Selection — Automatic

- For **Trivial**: Proceed directly — the change itself is the single task.
- For all others: **Auto-select tasks in dependency order.** Do NOT ask the user to choose a task. Read `tasks.md`, resolve the dependency graph, and start with tasks that have no pending dependencies. If multiple tasks are independent (no dependencies on each other), they may be executed in parallel or sequentially — use judgment based on whether they touch overlapping files.

### For each task:

1. Update `status.yaml` to set `phases.developer.current_task`.
2. Invoke the **Developer Agent** (`dev-agent` subagent) with:
   - The change name and workspace path
   - The specific task number, description, and done criteria from `tasks.md`
   - Instruction to read `design.md` for technical context
   - Instruction to read `proposal.md` for acceptance criteria
   - Instruction to follow TDD per the Developer Agent's classification-aware policy (strict TDD for bugs/small changes; iterative TDD permitted for new feature interface discovery)
   - Instruction to update task status in `tasks.md` to `done`
   - Instruction to report any out-of-scope issues discovered
3. After the Developer Agent completes, update `status.yaml`:
   - Move task from `tasks_pending` to `tasks_completed`
   - Remove `current_task`

### After each task completes:

Proceed immediately to the **Audit** phase for the completed task.

---

## Audit Phase

> **[Audit]** | Change: `<change-name>` | Classification: `<type>` | Pipeline: `<pipeline>`

Update `phases.qa.status` in `status.yaml` to `in_progress`.

Invoke the **QA Agent** (`qa-agent` subagent) with:

- The change name and workspace path
- The classification and QA mode (**lightweight** for Trivial, **full** for all others)
- The list of completed tasks
- Instruction to read `proposal.md`, `design.md`, and `tasks.md`
- Instruction to produce a structured review with findings categorized as Blocker / Major / Minor / Suggestion
- Instruction to provide file paths, line numbers, and concrete fix descriptions
- Instruction to classify fixes as surgical or structural

### If Audit passes (no Blockers or Major issues):

Update `phases.qa.status` to `pass`.

- If tasks remain in `tasks_pending`: **immediately return to Implement** and auto-select the next task(s) in dependency order. Do NOT ask the user to pick.
- If all tasks are done: **immediately proceed to Test Summary**. Do NOT ask for permission.

### If Audit fails:

Update `phases.qa.status` to `fail`.

- **Surgical fixes**: The Developer Agent fixes the issues automatically using the targeted checklist.
- **Structural fixes**: Return to Implement for rework automatically.

After fixes, re-invoke the QA Agent. **Repeat until Audit passes.** Do NOT ask the user for permission between fix-and-recheck cycles.

---

## Test Summary + Integration Verification (skip for Trivial)

**This phase starts automatically after QA passes. Do NOT ask for permission. After completing, immediately proceed to Deliver.**

> **[Test Summary]** | Change: `<change-name>` | Classification: `<type>` | Pipeline: `<pipeline>`

### Integration Verification (multi-task changes only)

If more than one task was completed:

1. Run the full project test suite.
2. Verify cross-task integration: interface mismatches, behavioral consistency, shared-state conflicts.
3. If integration issues are found, create a corrective task and return to Implement.

### Test Summary

Run the full test suite and produce:

| Field | Value |
|-------|-------|
| Test command(s) executed | _commands_ |
| Test suites run | _count_ |
| Total tests | _count_ |
| Passed / Failed / Skipped | _counts_ |
| Integration verification | _result (if multi-task)_ |
| Notes | _if applicable_ |

Update `phases.test_summary.status` in `status.yaml` to `complete`.

---

## Deliver — Change Summary + Cleanup

**This phase starts automatically after Test Summary completes. Do NOT ask for permission.**

> **[Deliver]** | Change: `<change-name>` | Classification: `<type>` | Pipeline: `<pipeline>`

1. **Delivered Change Summary**:
   - Change title and short description
   - Classification and pipeline used
   - Tasks completed (with brief descriptions)
   - Test summary
   - Breaking changes (if any)

2. **Append to `openspec/DELIVERED.md`** (create if it doesn't exist).

3. **Update OpenSpec artifacts**: mark tasks as `delivered` in `tasks.md`, update spec files.

4. **Update `status.yaml`**:

```yaml
phases:
  close:
    status: complete
    closed_at: <current ISO date>
```

5. **Discovered Issues Triage**: if the Developer Agent reported out-of-scope issues, list them and ask the user whether each should be tracked as a new change, noted as a known limitation, or dismissed.

6. Confirm the change is delivered and summarize what was shipped.

---

## Workflow Control Commands

The user may issue these commands at any point during the lifecycle:

| Command | Effect |
|---------|--------|
| **PM REVISE** | Return to Plan. Downstream artifacts are invalidated. Gate A approval is revoked. |
| **ARCH REVISE** | Return to Design. `tasks.md` is invalidated. Gate B approval is revoked. Completed tasks remain. |
| **CHANGE CANCEL** | Abandon the change. Mark all pending tasks as `cancelled`. Archive the workspace. |
| **SKIP QA** | Skip Audit. Allowed **only** for Trivial classification. Refused for all others. |
| **PAUSE** | Bookmark the current phase. Resume on next message by re-emitting the phase marker. |

---

## Enforcement Rules

You **must refuse** to:

- Write code before required approvals are granted
- Skip the Audit phase (except for Trivial with explicit SKIP QA)
- Deliver a change without producing a Final Test Summary (non-Trivial)
- Skip documentation updates in the Deliver phase
- Proceed past a gate without explicit approval text

You **must NEVER**:

- Suggest switching to Plan mode, Ask mode, or any other interaction mode. Always operate in Agent mode.
- Ask for permission to proceed to the next phase. Phase transitions are automatic — the only pause points are Gate A (PM Approval) and Gate B (Architect Approval). After any gate is passed or phase completes, immediately proceed to the next phase without asking.

---

## Confidence Signals

Every agent invocation must include a confidence signal at the end of its output:

| Signal | Meaning |
|--------|---------|
| **HIGH** | All inputs were clear, no ambiguity, standard patterns |
| **MEDIUM** | Some inference required, assumptions documented |
| **LOW** | Significant ambiguity remains, user should review carefully |

If LOW, explain specifically what drove the low confidence.
