# Plan — Define Requirements

You are the orchestrator for the planning phase of the AI SDLC. The user will provide a request description as a parameter to this command.

## Steps

### 1. Classify the Request (Phase 0)

Classify the user's request using these categories:

| Classification | Definition |
|----------------|-----------|
| **Trivial** | Scope, design, and acceptance criteria are all self-evident. A senior engineer would merge without discussion. |
| **Bug Fix** | Incorrect behavior with a clear expected outcome. |
| **Small Change** | Localized enhancement with obvious scope. No architectural decisions. |
| **New Feature** | New capability that requires requirements gathering and design. |
| **Major Refactor** | Structural change spanning multiple modules or layers. |

Select the pipeline:

| Classification | Pipeline |
|----------------|----------|
| **Trivial** | Phase 0 → Phase 3 (Dev) → Phase 4 (QA, lightweight) → Phase 6 |
| **Bug Fix** | Phase 0 → Phase 1 (PM lite) → Phase 3 (Dev) → Phase 4 (QA) → Phase 5 → Phase 6 |
| **Small Change** | Phase 0 → Phase 1 (PM) → Phase 2 (Arch) → Phase 3 → Phase 4 → Phase 5 → Phase 6 |
| **New Feature** | Full pipeline, all gates enforced |
| **Major Refactor** | Full pipeline, all gates enforced |

Emit the classification:

```
> **[Phase 0 — Classification]** | Request: "<one-sentence summary>"

**Classification:** <type>
**Reasoning:** <one sentence>
**Pipeline:** <pipeline>
```

### 2. Spec Drift Check

Before proceeding with the PM phase for any non-Trivial change:

1. If `openspec/spec.md` exists, scan it for references to modules, APIs, or behaviors that no longer exist in the codebase.
2. If drift is detected, surface it to the user before proceeding.
3. The user may choose to: fix the spec first, proceed with awareness, or defer spec updates.

### 3. Initialize State Tracking

1. Derive a kebab-case change name from the request.
2. Ensure `openspec/` exists. If not, run: `daisdlc spec init --tools none`
3. Create the change workspace: `daisdlc spec change create <change-name>`
4. Generate templates: `daisdlc spec change generate-templates <change-name>`
5. Create `openspec/changes/<change-name>/status.yaml` with this structure:

```yaml
change_name: <change-name>
classification: <classification>
pipeline: <pipeline>
created_at: <current ISO date>
phases:
  pm:
    status: in_progress
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

### 4. Invoke the PM Agent

Invoke the **PM Agent** (`pm-agent` subagent) with a prompt that includes:

- The user's original request (passed as the parameter to this command)
- The classification from Step 1
- The operating mode: **Full PM** for New Feature / Small Change / Major Refactor, or **PM Lite** for Bug Fix
- The change workspace path: `openspec/changes/<change-name>/`
- Instruction to read existing OpenSpec specs if they exist
- Instruction to populate `proposal.md` in the change workspace with the PM Brief

Wait for the PM Agent to complete its work.

### 5. Update State

After the PM Agent finishes, update `phases.pm.status` in `status.yaml` to `complete`.

### 6. Request Approval

Present the PM Brief output to the user and ask them to review. Instruct them to reply with **PM APPROVED** when satisfied.

When the user replies **PM APPROVED**, update `status.yaml`:

```yaml
phases:
  pm:
    status: approved
    approved_at: <current ISO date>
```

Confirm approval and tell the user they can now run `/daisdlc-design <change-name>` when ready to proceed to the Design phase.

**Do NOT auto-advance to the Design phase. Stop here.**
