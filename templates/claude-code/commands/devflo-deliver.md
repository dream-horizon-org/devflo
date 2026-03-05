---
description: Finalize a change with test summary, delivery log, and cleanup
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
argument-hint: change-name
---

# Deliver — Test Summary + Finalize

Finalize and deliver an AI SDLC change. The user will provide the change name as a parameter (e.g., `/devflo-deliver add-user-auth`).

## Steps

### 1. Validate Prerequisites

1. Read `openspec/changes/<change-name>/status.yaml`.
2. Verify that `phases.qa.status` is `pass`.

If prerequisites fail:

- If QA hasn't passed, suggest: "Run `/devflo-audit <change-name>` first."
- Explain what's missing and **stop — do not proceed**.

### 2. Phase 5 — Final Test Summary + Integration Verification

#### 2a. Integration Verification (multi-task changes only)

If `phases.developer.tasks_completed` has more than one task:

1. Run the **full project test suite** (not just task-specific tests).
2. Verify cross-task integration:
   - Are there interface mismatches between tasks?
   - Do the tasks produce consistent behavior when combined?
   - Are there shared-state conflicts (database, config, global state)?
3. If integration issues are found, report them and suggest running `/devflo-implement <change-name>` to create a corrective task. **Stop — do not proceed.**

#### 2b. Test Summary

1. Run the full project test suite.
2. Produce a Test Summary:

| Field | Value |
|-------|-------|
| Test command(s) executed | _commands run_ |
| Test suites run | _count_ |
| Total tests | _count_ |
| Passed / Failed / Skipped | _counts_ |
| Integration verification | _result (if multi-task)_ |
| Notes | _if applicable_ |

3. If any tests fail, report the failures and **stop — do not proceed to cleanup**.

4. Update `phases.test_summary.status` in `status.yaml` to `complete`.

### 3. Phase 6 — Change Summary + Cleanup

1. **Delivered Change Summary** — produce a summary containing:
   - Change title
   - Short description
   - Classification and pipeline used
   - Tasks completed (with brief descriptions)
   - Test summary (from Step 2)
   - Breaking changes (if any)

2. **Append to `openspec/DELIVERED.md`** — create the file if it does not exist. Use this format:

```markdown
## <Change Title>

- **Date:** <current date>
- **Classification:** <classification>
- **Pipeline:** <pipeline>
- **Tasks:** <list of completed tasks>
- **Breaking changes:** <if any, or "None">

<Short description of what was delivered.>

---
```

3. **Update OpenSpec artifacts:**
   - Mark all completed tasks as `delivered` in `tasks.md`.
   - Update spec files to reflect the new state if the change introduced new specifications.

4. **Update `status.yaml`:**

```yaml
phases:
  close:
    status: complete
    closed_at: <current ISO date>
```

5. **Discovered Issues Triage** — if the Developer Agent reported any out-of-scope issues during implementation:
   - List each issue.
   - Ask the user whether each should be:
     - Tracked as a new change (suggest running `/devflo-plan <issue description>`)
     - Noted in the spec as a known limitation
     - Dismissed

6. Confirm the change is delivered and summarize what was shipped.
