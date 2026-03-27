# skillx

> CLI to install, manage and publish skills for AI coding assistants

skillx is a package manager for AI coding assistant skills. It installs, updates, creates and publishes skills from GitHub, placing them automatically in the correct file structure for the target platform (Claude Code or Codex).

Think of skillx as `npm` for `.claude/skills/` -- a tool that standardizes distribution and installation of reusable AI skill components.

## Quick Start

```bash
# Install skillx globally
bun add -g skillx

# Install a skill from GitHub
skillx install user/awesome-skill

# List installed skills
skillx list

# Uninstall a skill
skillx uninstall awesome-skill
```

## Installation

Install skillx globally using your preferred package manager:

```bash
# Bun (recommended)
bun add -g skillx

# npm
npm install -g skillx

# pnpm
pnpm add -g skillx

# yarn
yarn global add skillx
```

Or run directly without installing:

```bash
bunx skillx install user/repo
npx skillx install user/repo
pnpx skillx install user/repo
```

## Commands

### `skillx install <source>`

Install a skill from a GitHub repository.

```bash
# Install from GitHub (shorthand)
skillx install user/repo

# Install a specific version (tag)
skillx install user/repo@v1.2.0

# Install a specific commit
skillx install user/repo@abc1234

# Install from a specific branch
skillx install user/repo#main

# Install for a specific platform only
skillx install user/repo --platform claude

# Force reinstall (overwrite existing)
skillx install user/repo --force
```

**Alias:** `skillx i`

The install command will:

1. Parse the specifier and resolve the GitHub repository
2. Download and extract the repository tarball
3. Read and validate the skill's `skillx.json` manifest
4. Copy skill files to the correct platform directories
5. Update the project's `skillx.json` and `skillx.lock`

### `skillx uninstall <name>`

Remove an installed skill.

```bash
# Uninstall a skill from all platforms
skillx uninstall blazor-best-practices

# Uninstall from a specific platform only
skillx uninstall blazor-best-practices --platform codex

# Skip confirmation prompt
skillx uninstall blazor-best-practices --force
```

**Alias:** `skillx un`

### `skillx list`

List all installed skills in the current project.

```bash
# List all installed skills
skillx list

# Filter by platform
skillx list --platform claude

# Show detailed file information from lockfile
skillx list --verbose
```

**Alias:** `skillx ls`

Example output:

```
Installed skills (3):

  blazor-best-practices  v1.0.0  allan/blazor-bp   claude codex
  react-hooks            v2.1.0  user/react-hooks   claude
  ts-conventions         v0.3.0  user/ts-conv       codex
```

### `skillx auth`

Manage GitHub authentication.

```bash
# Check current authentication status
skillx auth

# Launch interactive GitHub CLI login
skillx auth login
```

`skillx auth` displays which authentication method is currently active (environment variable or GitHub CLI). `skillx auth login` delegates to `gh auth login` for interactive setup.

### `skillx update` (coming in v0.2)

Update installed skills to their latest versions.

```bash
skillx update                    # Update all skills
skillx update my-skill           # Update a specific skill
skillx update --check            # Dry run: check for updates without installing
```

### `skillx search` (coming in v0.2)

Search for skills on GitHub.

```bash
skillx search blazor             # Search by keyword
skillx search "react testing"    # Search by phrase
skillx search --platform codex   # Filter by platform
```

Searches GitHub repositories with the `skillx-skill` topic.

### `skillx init` (coming in v0.3)

Scaffold a new skill package with an interactive wizard.

```bash
skillx init                                          # Interactive wizard
skillx init --name my-skill --platforms claude,codex  # Non-interactive
```

### `skillx publish` (coming in v0.3)

Validate and guide publication of a skill to GitHub.

```bash
skillx publish                   # Validate and guide publication
skillx publish --check           # Validation only (lint)
```

## Global Options

| Flag | Description |
|------|-------------|
| `--help`, `-h` | Show help information |
| `--version`, `-v` | Show version number |
| `--platform <name>` | Target platform: `claude`, `codex`, or `all` (default) |
| `--verbose` | Show detailed output |
| `--quiet` | Minimal output |
| `--force` | Force the operation (overwrite, skip confirmations) |

## Creating a Skill Package

A skill package is a GitHub repository with a `skillx.json` manifest and platform-specific files.

### Directory Structure

```
my-awesome-skill/
├── skillx.json               # Manifest (required)
├── README.md                 # Documentation
├── claude/                   # Claude Code files
│   ├── skills/
│   │   └── my-skill/
│   │       ├── SKILL.md
│   │       └── sub-skill/
│   │           └── SKILL.md
│   └── agents/               # Optional
│       └── my-agent.md
└── codex/                    # Codex files
    ├── AGENTS.md
    └── agents/               # Optional
        └── my-agent.toml
```

### skillx.json (Manifest)

```jsonc
{
  "name": "my-awesome-skill",
  "version": "1.0.0",
  "description": "What this skill does and when to use it",
  "author": "your-github-username",
  "license": "MIT",
  "platforms": ["claude", "codex"],
  "keywords": ["topic1", "topic2"],

  "claude": {
    "skills": ["claude/skills/"],
    "agents": ["claude/agents/"]
  },
  "codex": {
    "instructions": "codex/AGENTS.md",
    "agents": ["codex/agents/"],
    "strategy": "section"
  },

  "scripts": {
    "postinstall": "echo 'Skill installed successfully!'"
  }
}
```

**Required fields:** `name`, `version`, `description`, `platforms`

### SKILL.md Format (Claude Code)

Each `SKILL.md` file uses YAML frontmatter:

```yaml
---
name: skill-identifier
description: When and why to use this skill
allowed-tools: Read, Grep, Bash
model: sonnet
---

# Skill content here

Instructions for the AI coding assistant...
```

### Making Your Skill Discoverable

Add the `skillx-skill` topic to your GitHub repository so it appears in `skillx search` results. Recommended additional topics: `claude-code`, `codex`, `ai-skills`.

## Supported Platforms

### Claude Code

Skills are installed into the `.claude/` directory:

```
.claude/
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md
│       └── sub-skill/
│           └── SKILL.md
└── agents/
    └── <agent-name>.md
```

Each skill gets its own directory under `.claude/skills/`, avoiding conflicts between skills.

### Codex (OpenAI)

Skills are installed into the project root and `.codex/` directory:

```
AGENTS.md                     # Instructions (merged via section strategy)
.codex/
└── agents/
    └── <agent-name>.toml     # Agent definitions
```

For Codex, skillx uses a section-based merge strategy. Each skill's content is wrapped in comment markers to allow clean installation and removal:

```markdown
<!-- skillx:my-skill:start -->
## My Skill
[skill content]
<!-- skillx:my-skill:end -->
```

## Authentication

skillx supports private GitHub repositories. Tokens are resolved in the following order:

1. `SKILLX_GITHUB_TOKEN` environment variable
2. `GITHUB_TOKEN` environment variable
3. GitHub CLI token (via `gh auth token`)

skillx never stores tokens itself -- it delegates credential management to the GitHub CLI or your environment.

```bash
# Check authentication status
skillx auth

# Authenticate via GitHub CLI
skillx auth login

# Or set a token manually
export SKILLX_GITHUB_TOKEN=ghp_your_token_here
```

A token is only required for private repositories. Public repositories can be accessed without authentication.

## Project Files

When you install skills, skillx creates two tracking files in your project root:

- **`skillx.json`** -- Tracks installed skills (similar to `package.json`)
- **`skillx.lock`** -- Locks exact versions with resolved URLs and SHA hashes (similar to `package-lock.json`)

Both files should be committed to version control so your team uses the same skill versions.

## License

MIT
