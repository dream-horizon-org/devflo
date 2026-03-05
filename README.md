# daisdlc

AI Software Development Lifecycle for [Cursor](https://cursor.com) and [Claude Code](https://docs.claude.com/en/docs/claude-code). Installs a complete set of rules, agents, commands, and skills into any project via a single CLI command.

## What's Included

| Category | Files | Purpose |
|----------|-------|---------|
| **Rules** | `ai-sdlc-workflow.mdc` / `CLAUDE.md`, `must-follow.mdc` | Enforces the full SDLC lifecycle with approval gates, and coding standards (DRY, linting, test-first, 800-line limit) |
| **Agents** | `pm-agent.md`, `architect-agent.md`, `dev-agent.md`, `qa-agent.md` | Specialized agents for Product Management, Architecture, Development (TDD), and QA Review |
| **Commands** | `daisdlc.md`, `daisdlc-plan.md`, `daisdlc-design.md`, etc. | Slash commands for driving individual SDLC phases or the full lifecycle explicitly |
| **Skills** | `documentation-steward`, `reuse-before-write` | Automates OpenSpec documentation lifecycle and enforces reuse-first development |

## Supported Tools

| Tool | Target | Destination |
|------|--------|-------------|
| **Cursor IDE** | `cursor` | `.cursor/` directory (rules, agents, commands, skills) |
| **Claude Code** | `claude-code` | `.claude/` directory (agents, commands, skills) + `CLAUDE.md` at project root |

## Prerequisites

- Node.js >= 20
- A GitHub Personal Access Token (classic) with `read:packages` scope, or membership in the `dream-horizon-org` GitHub organization

## Setup

### 1. Configure the GitHub Packages registry

Create or edit `~/.npmrc` in your home directory and add:

```
@dream-horizon-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Replace `YOUR_GITHUB_TOKEN` with a GitHub PAT that has `read:packages` scope.

### 2. Install globally

```bash
npm install -g @dream-horizon-org/daisdlc
```

## Usage

### Initialize a project

Navigate to your project directory and run:

```bash
daisdlc init
```

You'll see an interactive prompt to select your AI coding tool:

```
? Select your AI coding tool: (Use arrow keys)
❯ Cursor IDE
  Claude Code
```

Cursor is selected by default. Press Enter to accept, or arrow down to pick Claude Code.

You can also skip the prompt with the `--target` flag:

```bash
daisdlc init --target cursor
daisdlc init --target claude-code
```

You can also specify a path:

```bash
daisdlc init ./path/to/project --target claude-code
```

### Update to the latest version

When a new version of daisdlc is published, upgrade and update your project:

```bash
npm update -g @dream-horizon-org/daisdlc
daisdlc update
```

The `update` command auto-detects which target was previously installed (from the version marker) and updates accordingly. You can override with `--target` if needed.

## What happens when you run `daisdlc init`

### Cursor IDE (`--target cursor`)

```
your-project/
└── .cursor/
    ├── .daisdlc              # Version marker (tracks installed version + target)
    ├── agents/
    │   ├── architect-agent.md
    │   ├── dev-agent.md
    │   ├── pm-agent.md
    │   └── qa-agent.md
    ├── commands/
    │   ├── daisdlc.md
    │   ├── daisdlc-plan.md
    │   ├── daisdlc-design.md
    │   ├── daisdlc-implement.md
    │   ├── daisdlc-audit.md
    │   ├── daisdlc-status.md
    │   └── daisdlc-deliver.md
    ├── rules/
    │   ├── ai-sdlc-workflow.mdc
    │   └── must-follow.mdc
    └── skills/
        ├── documentation-steward/
        │   ├── README.md
        │   └── SKILL.md
        └── reuse-before-write/
            └── SKILL.md
```

### Claude Code (`--target claude-code`)

```
your-project/
├── CLAUDE.md                 # SDLC workflow rules + coding standards (always loaded)
└── .claude/
    ├── .daisdlc              # Version marker (tracks installed version + target)
    ├── agents/
    │   ├── architect-agent.md
    │   ├── dev-agent.md
    │   ├── pm-agent.md
    │   └── qa-agent.md
    ├── commands/
    │   ├── daisdlc.md
    │   ├── daisdlc-plan.md
    │   ├── daisdlc-design.md
    │   ├── daisdlc-implement.md
    │   ├── daisdlc-audit.md
    │   ├── daisdlc-status.md
    │   └── daisdlc-deliver.md
    └── skills/
        ├── documentation-steward/
        │   ├── README.md
        │   └── SKILL.md
        └── reuse-before-write/
            └── SKILL.md
```

Existing files in `.cursor/` or `.claude/` that don't conflict with daisdlc files are left untouched. Files with the same name are overwritten.

## Commands

daisdlc installs slash commands that let you drive the SDLC pipeline explicitly. In Cursor, type `/` in the chat input. In Claude Code, type `/` at the prompt.

### Two ways to use the SDLC

1. **Automatic (rule-based):** Just describe your request in chat. The workflow rule automatically classifies it, selects the pipeline, and orchestrates phases in sequence with approval gates.

2. **Manual (command-driven):** Use the `/daisdlc-*` commands to invoke each phase yourself. This gives you full control over when each phase runs, and works across chat sessions since state is persisted in `status.yaml` inside the OpenSpec change workspace.

### Full lifecycle command

| Command | Description |
|---------|-------------|
| `/daisdlc <request>` | Run the complete SDLC pipeline from classification through delivery. Equivalent to the automatic rule, but invoked explicitly. Useful when the rule doesn't apply or you want to guarantee the full lifecycle runs. |

### Individual phase commands

Run phases one at a time, in any chat session. Each command checks prerequisites before proceeding.

| Command | Phase | Description |
|---------|-------|-------------|
| `/daisdlc-plan <request>` | Plan | Classifies the request, creates the OpenSpec change workspace, and invokes the PM Agent to produce a requirements brief. Stops at the **PM APPROVED** gate. |
| `/daisdlc-design <change-name>` | Design | Invokes the Architect Agent to produce `design.md` and `tasks.md`. Requires PM approval. Stops at the **ARCH APPROVED** gate. |
| `/daisdlc-implement <change-name> [task]` | Implement | Invokes the Developer Agent for a specific task using strict TDD. Requires Architect approval. If no task number is given, presents the task list for selection. |
| `/daisdlc-audit <change-name>` | Audit | Invokes the QA Agent to review the implementation against OpenSpec artifacts. Reports pass/fail with categorized findings. |
| `/daisdlc-deliver <change-name>` | Deliver | Runs the final test summary, integration verification, produces the delivered change summary, and appends to `DELIVERED.md`. |

### Utility command

| Command | Description |
|---------|-------------|
| `/daisdlc-status [change-name]` | Shows the current phase status of a specific change, or lists all active changes. Suggests the next command to run. |

### Example: manual workflow

```
# Session 1 — Plan
/daisdlc-plan Add rate limiting to the API
→ PM Brief produced, awaiting approval
PM APPROVED

# Session 2 — Design
/daisdlc-design add-rate-limiting
→ Design + task list produced, awaiting approval
ARCH APPROVED

# Session 3 — Implement + Audit
/daisdlc-implement add-rate-limiting 1
→ Task 1 implemented with TDD
/daisdlc-audit add-rate-limiting
→ QA passed

# Session 4 — Deliver
/daisdlc-implement add-rate-limiting 2
→ Task 2 implemented
/daisdlc-audit add-rate-limiting
→ QA passed
/daisdlc-deliver add-rate-limiting
→ Change delivered
```

### Bundled OpenSpec commands

daisdlc bundles the [OpenSpec CLI](https://openspec.dev/) as a dependency. No separate installation is needed. All OpenSpec commands are available via `daisdlc spec`:

```bash
daisdlc spec init --tools none
daisdlc spec change create <name>
daisdlc spec change generate-templates <name>
daisdlc spec change archive <name>
daisdlc spec validate
daisdlc spec status --json
```

Any OpenSpec command works — `daisdlc spec` forwards all arguments to the bundled OpenSpec binary.

> **Migration note:** If you previously ran `openspec <cmd>` directly, replace it with `daisdlc spec <cmd>`.

### State management

Commands persist state in `openspec/changes/<change-name>/status.yaml`, which tracks:

- Classification and pipeline
- Phase statuses (pending, in_progress, complete, approved, pass, fail)
- Gate approvals with timestamps
- Task completion progress

This enables **cross-session resumability** — start a change in one chat, continue it in another. Run `/daisdlc-status` at any time to see where you left off.

## Quick Start (TL;DR)

```bash
# One-time setup
echo '@dream-horizon-org:registry=https://npm.pkg.github.com' >> ~/.npmrc
echo '//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN' >> ~/.npmrc
npm install -g @dream-horizon-org/daisdlc

# In any project
cd your-project
daisdlc init
# Select "Cursor IDE" or "Claude Code" when prompted
```

## Contributing

### Project Structure

```
daisdlc/
├── .cursor/                    # This repo's own Cursor config (used during development)
├── templates/
│   ├── cursor/                 # Distributable assets for Cursor IDE
│   │   ├── agents/
│   │   ├── commands/
│   │   ├── rules/
│   │   └── skills/
│   └── claude-code/            # Distributable assets for Claude Code
│       ├── CLAUDE.md
│       ├── agents/
│       ├── commands/
│       └── skills/
├── src/
│   ├── cli.ts                  # CLI entry point (Commander)
│   ├── commands/
│   │   ├── init.ts             # daisdlc init (with interactive target prompt)
│   │   ├── update.ts           # daisdlc update (auto-detects target)
│   │   └── spec.ts             # daisdlc spec (OpenSpec passthrough)
│   └── utils/
│       ├── copy.ts             # Target-aware file copy and version marker utilities
│       └── openspec.ts         # Bundled OpenSpec binary resolution and execution
├── .github/workflows/
│   └── publish.yml             # Publishes to GitHub Packages on tag push
└── package.json
```

### Development Setup

```bash
git clone https://github.com/dream-horizon-org/daisdlc.git
cd daisdlc
npm install
npm run build
```

### Editing Rules, Agents, Commands, or Skills

**Cursor templates:** The canonical source lives in `.cursor/` at the project root. Edit files there, then sync them to `templates/cursor/` before publishing:

```bash
npm run sync-templates
```

This is also run automatically as part of `prepublishOnly`.

**Claude Code templates:** Maintained directly in `templates/claude-code/`. Edit those files in place.

### Building

```bash
npm run build       # Compile TypeScript to dist/
npm run clean       # Remove dist/
```

### Publishing a New Version

Releases are automated via GitHub Actions. To publish a new version:

1. **Push your changes** to the `main` branch (or your default branch).

2. **Create and push a version tag.** The tag determines the published package version:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

   The GitHub Actions workflow will automatically:
   - Install dependencies
   - Set the package version from the tag
   - Build the project
   - Publish to GitHub Packages

3. **Verify** the package appears at:
   `https://github.com/orgs/dream-horizon-org/packages/npm/daisdlc`

There is no need to manually bump the version in `package.json` -- the workflow extracts it from the git tag.

### Version Tagging Convention

Tags must start with `v` followed by a valid semver version:

| Tag | Published Version |
|-----|-------------------|
| `v0.1.0` | `0.1.0` |
| `v1.0.0` | `1.0.0` |
| `v2.3.1` | `2.3.1` |

## License

MIT
