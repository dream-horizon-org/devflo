---
name: reuse-before-write
description: Search the codebase for existing reusable code before writing new implementations. Use when the user describes a feature, change, or selects code for modification. Enforces a mandatory reuse-search workflow that recommends reuse, refactor, or composition over generating new code.
---

# Reuse Before Write

Always search for existing reusable code (functions, utilities, components, hooks, services, helpers, patterns) before generating anything new. Default to reuse/refactor/composition.

## Mandatory Workflow

Complete every step in order. Do not skip the search phase.

### Step 1: Restate the Request

Summarize the user's request in one sentence.

### Step 2: Search for Reuse Candidates

Use semantic search and keyword search across the codebase.

**What to look for:**
- Functions with the same responsibility or similar naming
- Matching types, similar call sites, similar I/O signatures
- Existing tests covering related logic
- Utilities in common locations: `/utils`, `/lib`, `/shared`, `/services`, `/hooks`, `/components`, `/common`

**Pattern keywords to search:**
`mapper`, `serializer`, `validator`, `adapter`, `client`, `repository`, `handler`, `middleware`, `factory`, `builder`, `normalizer`

Also search for synonyms and related terms derived from the user's request.

### Step 3: Present Findings

Show a shortlist table:

| Candidate | File path | What it does | Why it matches | Effort |
|-----------|-----------|--------------|----------------|--------|
| `functionName` | `src/utils/foo.ts` | Brief description | Relevance to request | Reuse as-is / Small refactor / Wrapper / Extend |

If no candidates are found, state that explicitly with the search terms used.

### Step 4: Recommend an Approach

Pick one:

- **A) Reuse as-is** — show exact usage code
- **B) Create a small wrapper** — show wrapper code
- **C) Refactor/extend existing code** — show minimal diff
- **D) Write new code** — only if nothing reusable exists; explain why

### Step 5: Implement

If modifications are needed:
- Prefer minimal changes
- Do not break public APIs unless the user explicitly allows it
- Update or add tests where relevant
- Keep style consistent with the existing codebase

### Step 6: List Search Terms

After proposing the solution, list all search terms used so the user can refine the query.

## Output Format

Structure every response as:

```
## Request
[One-sentence restatement]

## Reuse Candidates
[Table from Step 3]

## Recommendation
[Approach A/B/C/D with rationale]

## Implementation
[Code or diff]

## Tests / Verification
[Updated or new tests, if applicable]

## Search Terms Used
[Bulleted list of all search queries]
```

## Hard Rules

1. **Do not generate new implementations** until the reuse search is complete and candidates are shown.
2. **If reuse requires <= 20 lines of change, do NOT write new code.**
3. **Prefer wrappers over copying logic.**
4. **Avoid duplicate utilities.** Prefer existing tested code.
5. If multiple candidates exist, choose the one that is most central/shared and easiest to maintain.
6. If new code is unavoidable, place it in the most consistent existing layer (`utils`/`service`/`hook`/`component`) and explain why that location is correct.

## Examples of Good Behavior

- A similar function exists → show how to call it, not rewrite it.
- A function exists but isn't quite right → propose extending or refactoring it instead of duplicating.
- A pattern exists (error handling, retries, logging) → reuse that pattern consistently.
