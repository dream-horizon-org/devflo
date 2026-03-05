# Audit — Quality Review

You are the orchestrator for the audit phase of the AI SDLC. The user will provide the change name as a parameter (e.g., `/devflo-audit add-user-auth`).

## Steps

### 1. Validate Prerequisites

1. Read `openspec/changes/<change-name>/status.yaml`.
2. Verify that `phases.developer.tasks_completed` has at least one entry.
3. Verify that `openspec/changes/<change-name>/design.md` and `tasks.md` exist.

If prerequisites fail:

- Suggest: "Run `/devflo-implement <change-name> <task>` to complete at least one task first."
- Explain what's missing and **stop — do not proceed**.

### 2. Determine QA Mode

Read the `classification` field from `status.yaml`:

- **Trivial**: Use lightweight QA — verify correctness, check for regressions, confirm tests pass. The full structured review format is not required.
- **Bug Fix / Small Change / New Feature / Major Refactor**: Use full QA — structured review with categorized findings.

### 3. Update State

Update `phases.qa.status` in `status.yaml` to `in_progress`.

### 4. Invoke the QA Agent

Invoke the **QA Agent** (`qa-agent` subagent) with a prompt that includes:

- The change name and workspace path: `openspec/changes/<change-name>/`
- The classification and QA mode (lightweight vs full)
- The list of completed tasks from `status.yaml`
- Instruction to read `proposal.md` for acceptance criteria
- Instruction to read `design.md` for technical design
- Instruction to read `tasks.md` for done criteria of each completed task
- Instruction to review the implementation against all OpenSpec artifacts
- Instruction to produce a structured review with categorized findings: **Blocker** / **Major** / **Minor** / **Suggestion**
- Instruction to provide file paths, line numbers, and concrete fix descriptions for each issue
- Instruction to classify each fix as **surgical** (single-location, no design impact) or **structural** (requires approach revision)

Wait for the QA Agent to complete its work.

### 5. Handle QA Result

**If QA passes** (no Blockers or Major issues):

Update `phases.qa.status` in `status.yaml` to `pass`.

**Immediately proceed to the Deliver phase** — invoke `/devflo-deliver <change-name>` behavior (test summary, change summary, cleanup). Do NOT stop to ask the user for permission.

**If QA fails** (Blockers or Major issues remain):

Update `status.yaml`:

```yaml
phases:
  qa:
    status: fail
    findings_count: <number of blockers + majors>
```

- **Surgical fixes**: The Developer Agent fixes the issues automatically using the targeted checklist, then re-run QA.
- **Structural fixes**: Return to Implement automatically to address the structural issues, then re-run QA.

**Repeat the fix → re-audit loop automatically until QA passes.** Do NOT stop to ask the user for permission between cycles.
