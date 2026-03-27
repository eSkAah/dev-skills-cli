#!/usr/bin/env bun

const VERSION = "0.1.0";

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  console.log(`
  skillx v${VERSION} — AI coding assistant skill manager

  Usage: skillx <command> [options]

  Commands:
    install, i <source>     Install a skill from GitHub
    uninstall, un <name>    Uninstall a skill
    list, ls                List installed skills
    update [name]           Update skills
    search <query>          Search skills on GitHub
    init                    Create a new skill package
    publish                 Validate and publish a skill
    auth                    Manage GitHub authentication

  Options:
    --help, -h              Show this help
    --version, -v           Show version
    --platform <name>       Target platform (claude, codex, all)
    --verbose               Show detailed output
    --quiet                 Minimal output

  Examples:
    skillx install user/repo
    skillx install user/repo@v1.0.0
    skillx i user/repo --platform claude
    skillx list --verbose
    skillx search "react testing"
`);
  process.exit(0);
}

if (command === "--version" || command === "-v") {
  console.log(VERSION);
  process.exit(0);
}

console.log(`skillx: unknown command "${command}". Run "skillx --help" for usage.`);
process.exit(1);
