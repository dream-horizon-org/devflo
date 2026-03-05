# Documentation Steward

A Claude Code skill that automates documentation lifecycle tasks for the AI SDLC workflow.

## Capabilities

- **Initialize OpenSpec change workspaces** — scaffolds a new change with all required templates.
- **Validate documentation** — checks completeness and correctness of OpenSpec artifacts.
- **Close and archive changes** — finalizes documentation after QA passes, appends to the delivered changes log.
- **Maintain `openspec/DELIVERED.md`** — keeps a persistent record of all delivered changes.

## When It's Used

This skill is invoked by the AI SDLC workflow at key phase boundaries:

| Phase | Action |
|-------|--------|
| PM Phase (Phase 1) | `INIT_CHANGE_WORKSPACE` — create the change workspace before requirements gathering. |
| Architect / Developer (Phases 2–3) | `VALIDATE_DOCUMENTATION` — verify artifacts are complete during design and implementation. |
| QA Pass + Closure (Phases 4–6) | `CLOSE_AND_ARCHIVE_CHANGE` — finalize, log, and archive after QA approval. |

## File Structure

```
documentation-steward/
├── README.md    # This file — overview and context
└── SKILL.md     # Skill definition with three actions
```

## Prerequisites

- `daisdlc` installed globally (OpenSpec CLI is bundled — no separate installation needed).
- The repository should have (or will get) an `openspec/` directory at the project root.
