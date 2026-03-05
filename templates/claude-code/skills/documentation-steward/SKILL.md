---
name: documentation-steward
description: Automate OpenSpec documentation lifecycle tasks including creating change workspaces, validating documentation completeness, detecting spec drift, and closing/archiving changes after QA passes. Use when initializing a new change, validating OpenSpec artifacts, checking for spec drift, closing a completed change, or maintaining the DELIVERED.md log.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Documentation Steward

Automates creation, validation, drift detection, and closure of OpenSpec change documentation and maintains the delivered changes log.

Pick the appropriate action based on the current SDLC phase.

---

## Action 1 — INIT_CHANGE_WORKSPACE

Prepare documentation for a new change.

```
Progress:
- [ ] Ensure OpenSpec is initialized
- [ ] Create change workspace
- [ ] Generate templates
- [ ] Verify workspace contents
- [ ] Output summary
```

### Steps

**1. Ensure OpenSpec is initialized.**
Check for the `openspec/` directory at the project root. If it does not exist:

```bash
devflo spec init --tools none
```

**2. Create the change workspace.**

```bash
devflo spec change create <change-name>
```

Replace `<change-name>` with a kebab-case identifier for the change (e.g. `add-user-auth`).

**3. Generate templates.**

```bash
devflo spec change generate-templates <change-name>
```

**4. Verify the workspace contains the required files:**

| File | Required |
|------|----------|
| `proposal.md` | Yes |
| `design.md` | Yes |
| `tasks.md` | Yes |
| `spec.md` | If applicable |

List the workspace directory and confirm each file exists. If any required file is missing, re-run template generation or create the file manually.

**5. Output a short summary** of the created workspace: path, files present, and next steps.

---

## Action 2 — VALIDATE_DOCUMENTATION

Verify that documentation is complete and valid.

```
Progress:
- [ ] Run validation
- [ ] Collect status
- [ ] Summarize results
- [ ] Provide suggestions
```

### Steps

**1. Run OpenSpec validation.**

```bash
devflo spec validate
```

**2. Collect structured status** (if the command is available):

```bash
devflo spec status --json
```

**3. Summarize results.** Report:

- Missing or empty sections
- Incomplete tasks (from `tasks.md`)
- Validation warnings and errors

**4. Provide actionable suggestions** for each issue found. Example format:

```
| Issue | Location | Suggestion |
|-------|----------|------------|
| Missing test strategy | design.md §Testing | Add a test strategy section covering unit/integration scope |
| Task not started | tasks.md #3 | Mark in-progress or provide rationale for deferral |
```

If validation passes with no issues, confirm the documentation is complete.

---

## Action 3 — SPEC_DRIFT_CHECK

Detect and report drift between `openspec/spec.md` and the actual codebase. This action should be run before starting Phase 1 for any non-Trivial change, or on-demand when the user requests it.

```
Progress:
- [ ] Check if spec.md exists
- [ ] Scan spec for referenced artifacts
- [ ] Cross-reference with codebase
- [ ] Report findings
- [ ] Present options to user
```

### Steps

**1. Check if `openspec/spec.md` exists.** If it does not, report that no spec exists to drift-check and suggest initializing one if the project warrants it. Stop here.

**2. Scan `spec.md` for referenced artifacts.** Extract references to:

- Module names and file paths
- API endpoints or CLI commands
- Function/class names mentioned as part of the specification
- Configuration keys or environment variables
- Database tables, schemas, or models

**3. Cross-reference with the codebase.** For each referenced artifact:

- Verify it still exists in the codebase at the expected location.
- Check that the described behavior matches the current implementation (at a surface level — function signatures, exports, route definitions).
- Flag artifacts that have been renamed, moved, or deleted.

**4. Report findings** in a structured table:

```
| Spec Reference | Expected Location | Status | Details |
|---------------|-------------------|--------|---------|
| `UserService` | `src/services/user.ts` | OK | Exists and matches |
| `POST /api/auth` | `src/routes/auth.ts` | DRIFTED | Endpoint renamed to `/api/v2/auth` |
| `config.redis_url` | `.env` / config module | MISSING | No longer referenced in codebase |
```

**5. Present options to the user:**

- **Fix spec first** — update `spec.md` to reflect current reality before starting the new change.
- **Proceed with awareness** — note the drift but continue. The change may resolve some drift naturally.
- **Defer spec updates** — address drift as a separate change after the current work is complete.

If no drift is detected, confirm the spec is in sync.

---

## Action 4 — CLOSE_AND_ARCHIVE_CHANGE

Finalize documentation after QA passes.

```
Progress:
- [ ] Verify all tasks completed
- [ ] Run final validation
- [ ] Generate delivered change summary
- [ ] Append to DELIVERED.md
- [ ] Archive the change workspace
- [ ] Output confirmation
```

### Steps

**1. Verify all tasks in `tasks.md` are marked completed.** If any are incomplete, stop and report them.

**2. Run final validation.**

```bash
devflo spec validate
```

Resolve any errors before proceeding.

**3. Generate a Delivered Change Summary** using this template:

```markdown
## <Change Name>

- **Date**: YYYY-MM-DD
- **Classification**: <Trivial | Bug Fix | Small Change | New Feature | Major Refactor>
- **Pipeline**: <pipeline used>
- **Summary**: <One-paragraph description of the change>
- **Tasks completed**: <Bullet list of completed tasks>
- **Test summary**: <Provided by QA phase — include pass/fail counts>
- **Breaking changes**: <List or "None">
- **Workspace**: `openspec/changes/<change-name>/` (archived)
```

**4. Append the summary to `openspec/DELIVERED.md`.** Create the file if it does not exist. Add a top-level heading (`# Delivered Changes`) on first creation. Append new entries at the bottom.

**5. Archive the change workspace.**

```bash
devflo spec change archive <change-name>
```

**6. Output a confirmation summary** including: change name, archive status, and a reminder to update any related spec files to reflect the new state.

---

## Action 5 — CANCEL_CHANGE

Handle change cancellation when the user issues `CHANGE CANCEL`.

```
Progress:
- [ ] Mark tasks as cancelled
- [ ] Add cancellation note
- [ ] Archive as cancelled
- [ ] Output confirmation
```

### Steps

**1. Mark all pending tasks** in `tasks.md` as `cancelled`. Completed tasks retain their status.

**2. Add a cancellation note** to `proposal.md`:

```markdown
## Cancellation

- **Date**: YYYY-MM-DD
- **Reason**: <User-initiated cancellation>
- **Tasks completed before cancellation**: <List or "None">
```

**3. Archive the change workspace** with a cancelled status:

```bash
devflo spec change archive <change-name>
```

**4. Do not append to `DELIVERED.md`** — cancelled changes are not delivered.

**5. Output a confirmation** including: change name, cancellation status, and any completed work that was preserved.
