---
name: documentation-steward
description: Automate OpenSpec documentation lifecycle tasks including creating change workspaces, validating documentation completeness, and closing/archiving changes after QA passes. Use when initializing a new change, validating OpenSpec artifacts, closing a completed change, or maintaining the DELIVERED.md log.
---

# Documentation Steward

Automates creation, validation, and closure of OpenSpec change documentation and maintains the delivered changes log.

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
openspec init --tools none
```

**2. Create the change workspace.**

```bash
openspec change create <change-name>
```

Replace `<change-name>` with a kebab-case identifier for the change (e.g. `add-user-auth`).

**3. Generate templates.**

```bash
openspec change generate-templates <change-name>
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
openspec validate
```

**2. Collect structured status** (if the command is available):

```bash
openspec status --json
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

## Action 3 — CLOSE_AND_ARCHIVE_CHANGE

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
openspec validate
```

Resolve any errors before proceeding.

**3. Generate a Delivered Change Summary** using this template:

```markdown
## <Change Name>

- **Date**: YYYY-MM-DD
- **Summary**: <One-paragraph description of the change>
- **Tasks completed**: <Bullet list of completed tasks>
- **Test summary**: <Provided by QA phase — include pass/fail counts>
- **Breaking changes**: <List or "None">
```

**4. Append the summary to `openspec/DELIVERED.md`.** Create the file if it does not exist. Add a top-level heading (`# Delivered Changes`) on first creation. Append new entries at the bottom.

**5. Archive the change workspace.**

```bash
openspec change archive <change-name>
```

**6. Output a confirmation summary** including: change name, archive status, and a reminder to update any related spec files to reflect the new state.
