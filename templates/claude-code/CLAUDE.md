# AI Software Development Lifecycle — Workflow Rule

Spec-Driven + Test-Driven workflow using OpenSpec. Follow phases in strict order. Never skip mandatory phases.

## Phases

```
0 Classification → 1 PM → [Gate A: PM APPROVED] → 2 Architect → [Gate B: ARCH APPROVED] → 3 Dev (TDD) → 4 QA → 5 Test Summary → 6 Cleanup
```

---

## Phase 0 — Classification (routing only)

Phase 0 is a routing decision ONLY. It must NOT: analyze code, list files/modules, suggest solutions, describe technical details, produce task lists, or speculate about scope/risks. All analysis belongs to PM (Phase 1) and Architect (Phase 2).

Classify as: **Trivial** | **Bug Fix** | **Small Change** | **New Feature** | **Major Refactor**

| Type | Definition |
|------|-----------|
| Trivial | Self-evident scope/design. Typo, version bump, rename. |
| Bug Fix | Incorrect behavior, clear expected outcome. |
| Small Change | Localized enhancement, obvious scope, no arch decisions. |
| New Feature | New capability requiring requirements + design. |
| Major Refactor | Structural change spanning multiple modules. |

### Pipelines

| Type | Pipeline | Gates |
|------|----------|-------|
| Trivial | 0→3→4(lite)→6 | None |
| Bug Fix | 0→1(PM lite)→3→4→5→6 | Gate A |
| Small Change | 0→1→2→3→4→5→6 | A, B |
| New Feature | Full (0→1→2→3→4→5→6) | A, B |
| Major Refactor | Full (0→1→2→3→4→5→6) | A, B |

- **PM lite**: minimal brief — problem, expected behavior, repro steps, single acceptance criterion.
- **Lightweight QA**: verify correctness, regressions, tests pass. Full structured review not required.

### Phase 0 Output (strict format, nothing more)

```
> **[Phase 0 — Classification]** | Request: "<summary>"

**Classification:** <type>
**Reasoning:** <one sentence>
**Pipeline:** <from table>
**Next:** Proceeding to Phase <X>.
```

Immediately invoke next phase's agent. No commentary, no waiting for user input.

---

## Phase State Tracking

Every response advancing the workflow must start with:

> **[Phase X — \<Name\>]** | Change: `<name>` | Classification: `<type>` | Pipeline: `<id>`

---

## Spec Drift Check (Pre-Phase 1, non-Trivial only)

If `openspec/spec.md` exists, scan for stale references to modules/APIs/behaviors. Surface drift to user before proceeding.

---

## Phase 1 — PM

Invoke the `pm-agent` agent. Key orchestrator directives:
- **MANDATORY: Present ALL clarifying questions directly to the user as numbered options in your response. Group related questions together. Always provide concrete options with trade-offs. Wait for the user's reply before proceeding. Never ask open-ended questions. NEVER skip questions for New Feature/Major Refactor.**
- Create OpenSpec change workspace via CLI and populate `proposal.md`
- If scope has 3+ capabilities, surface scope reduction as a question with options
- Bug Fix → PM lite mode

**Stop and request PM APPROVED.**

---

## Gate A — PM Approval

User must reply exactly **PM APPROVED**. Refuse to proceed without it.

When the user replies **PM REVISE** (with or without additional text):
- If additional text accompanies the command → treat it as revision feedback. Re-invoke `pm-agent` in **Revision mode** with that feedback. The PM must apply the feedback to the existing proposal without re-running the full question flow.
- If no additional text → prompt the user: "Please describe what should change." Treat their next message as revision feedback and re-invoke `pm-agent` in **Revision mode**.

---

## Phase 2 — Architect

Invoke the `architect-agent` agent. Key orchestrator directives:
- **MANDATORY: Present at least one architectural/approach question directly to the user as numbered options BEFORE writing the full design. NEVER skip for New Feature/Major Refactor. For Small Change, skip ONLY when literally one approach exists with zero alternatives.**
- Validate approach with user via numbered options before producing full design
- Populate `design.md` and `tasks.md` in the OpenSpec change workspace
- Define test strategy and produce ordered, dependency-aware task list

**Stop and request ARCH APPROVED.**

---

## Gate B — Architect Approval

User must reply exactly **ARCH APPROVED**. No implementation may begin before this gate.

When the user replies **ARCH REVISE** (with or without additional text):
- If additional text accompanies the command → treat it as revision feedback. Re-invoke `architect-agent` in **Revision mode** with that feedback. The Architect must apply the feedback to the existing design without re-running the full question flow.
- If no additional text → prompt the user: "Please describe what should change." Treat their next message as revision feedback and re-invoke `architect-agent` in **Revision mode**.

---

## Phase 3 — Developer

After Gate B (or directly after Phase 0 for Trivial):

1. Auto-select tasks in dependency order from `tasks.md`. Do NOT ask user which task.
2. Invoke `dev-agent` per task. TDD mandatory (strict default; iterative TDD permitted for new interfaces being defined for the first time).
3. Update task status in OpenSpec on completion.
4. Immediately proceed to next task. Do NOT pause between tasks.

Trivial: no formal task list needed — the change is the single task.

---

## Phase 4 — QA (auto-starts, no permission needed)

1. Invoke `qa-agent`. Do NOT ask user for permission.
2. If QA FAIL (Blockers/Majors remain): Dev fixes → QA re-reviews flagged issues only. Repeat until QA PASS.
3. QA must provide file paths, line numbers, concrete fix descriptions. Classify as **surgical** (single-location) or **structural** (approach revision).
4. Surgical-only fixes → Developer gets targeted checklist, not full re-analysis.
5. On QA PASS → immediately proceed to Phase 5.

---

## Phase 5 — Test Summary (auto-starts, no permission needed)

### 5a. Integration Verification (multi-task only)

Run full test suite. Verify cross-task integration: interface mismatches, behavioral consistency, shared-state conflicts. If issues found → create corrective task → return to Phase 3.

### 5b. Test Summary (mandatory, cannot be skipped)

| Field | Required |
|-------|----------|
| Test command(s) executed | Yes |
| Test suites run | Yes |
| Total tests | Yes |
| Passed / Failed / Skipped | Yes |
| Integration verification result | If multi-task |
| Notes | If tests couldn't run locally |

Immediately proceed to Phase 6.

---

## Phase 6 — Cleanup (auto-starts, no permission needed)

1. **Delivered Change Summary**: title, description, classification/pipeline, tasks completed, test summary, breaking changes, workspace link
2. **Append to `openspec/DELIVERED.md`** (create if needed)
3. **Update OpenSpec artifacts**: mark tasks completed in `tasks.md`, update spec files
4. **Discovered Issues Triage**: if Dev reported out-of-scope issues, ask user per issue: track as new change | note as known limitation | dismiss

---

## Control Commands

| Command | Effect |
|---------|--------|
| **PM REVISE** | Return to Phase 1. Invalidates `design.md`, `tasks.md`. Revokes Gate A. |
| **ARCH REVISE** | Return to Phase 2. Invalidates `tasks.md`. Revokes Gate B. Completed tasks preserved. |
| **CHANGE CANCEL** | Cancel all pending tasks. Archive workspace as cancelled. No DELIVERED.md entry. |
| **SKIP QA** | Trivial only. Refused for all other classifications. |
| **PAUSE** | Bookmark phase. Resume on next message with phase marker. |

On REVISE: inform user of invalidated artifacts, re-enter target phase, all downstream gates must be re-approved.
On CANCEL: mark pending tasks `cancelled`, archive workspace, inform user.

---

## Asking User Questions — MANDATORY ACROSS ALL PHASES

Every agent (PM, Architect, Developer) must present questions directly to the user as numbered options in their response when clarification is needed. Rules:

- Present questions with 2–5 distinct options, each with trade-off descriptions
- Include a "You decide — pick the best option" choice where appropriate
- Group related questions together; batch independent questions
- Wait for the user to respond before proceeding — this is a blocker
- NEVER skip questions for New Feature or Major Refactor classifications
- NEVER ask open-ended questions — always provide concrete options

---

## Enforcement

**Must refuse to:**
- Write code before required approvals (per pipeline)
- Skip QA (except Trivial + explicit SKIP QA)
- Close without producing Test Summary
- Skip Phase 6 documentation updates
- Process SKIP QA for non-Trivial
- Pass a gate without explicit approval text

**Must NEVER:**
- Suggest breaking the workflow into separate conversations or stopping the lifecycle flow. Always keep the SDLC running within the current session.
- Ask permission to proceed after a gate passes or phase completes. Phase transitions are automatic — only Gate A and Gate B are pause points.

---

## Confidence Signals

Every agent output must end with: **Confidence: HIGH | MEDIUM | LOW**

- **HIGH**: Clear inputs, no ambiguity, standard patterns
- **MEDIUM**: Some inference required, assumptions documented
- **LOW**: Significant ambiguity — must explain what drove it

---

# Coding Standards

- Always adhere to the DRY (Don't Repeat Yourself) principle and write clean, well-structured code that follows standard best practices.

- While coding, follow linting rules to minimize rework and ensure consistency.

- After completing your code changes, run linting checks and resolve all issues before committing the code.

- Ensure that the code is secure and production-ready.

- For every new feature, always write appropriate unit and integration tests.

- When modifying existing code, do not change the tests first. Update the code, run the existing tests to verify behavior, and only if tests fail, analyze the root cause and take the necessary corrective action.

- Never let any file exceed 800 lines of code. If your changes cause a file to go beyond this limit, pause and reconsider the design — apply the Single Responsibility Principle to refactor and split the file into smaller, focused modules.
