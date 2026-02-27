# daisdlc

AI Software Development Lifecycle for [Cursor](https://cursor.com). Installs a complete set of rules, agents, and skills into any project's `.cursor/` directory via a single CLI command.

## What's Included

| Category | Files | Purpose |
|----------|-------|---------|
| **Rules** | `ai-sdlc-workflow.mdc`, `must-follow.mdc` | Enforces the full SDLC lifecycle (Phases 0-6) with approval gates, and coding standards (DRY, linting, test-first, 800-line limit) |
| **Agents** | `pm-agent.md`, `architect-agent.md`, `dev-agent.md`, `qa-agent.md` | Specialized agents for Product Management, Architecture, Development (TDD), and QA Review |
| **Skills** | `documentation-steward`, `reuse-before-write` | Automates OpenSpec documentation lifecycle and enforces reuse-first development |

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

This copies all SDLC rules, agents, and skills into your project's `.cursor/` directory.

You can also specify a path:

```bash
daisdlc init ./path/to/project
```

### Update to the latest version

When a new version of daisdlc is published, upgrade and update your project:

```bash
npm update -g @dream-horizon-org/daisdlc
daisdlc update
```

The `update` command checks the installed version against the package version and only copies files if there's a newer version available.

## What happens when you run `daisdlc init`

```
your-project/
└── .cursor/
    ├── .daisdlc              # Version marker (tracks installed version)
    ├── agents/
    │   ├── architect-agent.md
    │   ├── dev-agent.md
    │   ├── pm-agent.md
    │   └── qa-agent.md
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

Existing files in `.cursor/` that don't conflict with daisdlc files are left untouched. Files with the same name are overwritten.

## Quick Start (TL;DR)

```bash
# One-time setup
echo '@dream-horizon-org:registry=https://npm.pkg.github.com' >> ~/.npmrc
echo '//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN' >> ~/.npmrc
npm install -g @dream-horizon-org/daisdlc

# In any project
cd your-project
daisdlc init
```

## Contributing

### Project Structure

```
daisdlc/
├── .cursor/                    # This repo's own Cursor config (used during development)
├── templates/
│   └── cursor/                 # Distributable assets (shipped in the npm package)
│       ├── agents/
│       ├── rules/
│       └── skills/
├── src/
│   ├── cli.ts                  # CLI entry point (Commander)
│   ├── commands/
│   │   ├── init.ts             # daisdlc init
│   │   └── update.ts           # daisdlc update
│   └── utils/
│       └── copy.ts             # File copy and version marker utilities
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

### Editing Rules, Agents, or Skills

The canonical source for SDLC content lives in `.cursor/` at the project root. Edit files there, then sync them to `templates/cursor/` before publishing:

```bash
npm run sync-templates
```

This is also run automatically as part of `prepublishOnly`, so you don't need to remember it when publishing.

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
