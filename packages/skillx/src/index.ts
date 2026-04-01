#!/usr/bin/env node

import { parseArgs } from "./utils/args.js";
import { logger, setVerbose, setQuiet } from "./utils/logger.js";
import { installCommand } from "./commands/install.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { listCommand } from "./commands/list.js";
import { searchCommand } from "./commands/search.js";
import { authCommand } from "./commands/auth.js";
import { updateCommand } from "./commands/update.js";

const VERSION = "0.1.0";

const HELP_TEXT = `
  skillx v${VERSION} — AI coding assistant skill manager

  Usage: skillx <command> [options]

  Commands:
    install, i <source>     Install a skill from GitHub
    uninstall, un <name>    Uninstall a skill
    update, up [name]       Update installed skills
    list, ls                List installed skills
    search, s <query>       Search for skills on GitHub
    auth                    Manage GitHub authentication

  Options:
    --help, -h              Show this help
    --version, -v           Show version
    --platform <name>       Target platform (claude, codex, all)
    --verbose               Show detailed output
    --quiet                 Minimal output
    --force                 Force operation (overwrite, etc.)
    --check                 Dry run (update command only)

  Examples:
    skillx install user/repo
    skillx install user/repo@v1.0.0
    skillx i user/repo --platform claude
    skillx update --check
    skillx list --verbose
    skillx search blazor
    skillx s "react testing" --platform claude
`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Apply global flags
  if (args.flags.verbose) setVerbose(true);
  if (args.flags.quiet) setQuiet(true);

  // Handle --version anywhere
  if (args.flags.version) {
    console.log(VERSION);
    process.exit(0);
  }

  // Handle --help anywhere, or no command
  if (args.flags.help || !args.command) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  // Route to command handlers
  switch (args.command) {
    case "install":
      await installCommand(args);
      break;

    case "uninstall":
      await uninstallCommand(args);
      break;

    case "list":
      await listCommand(args);
      break;

    case "search":
      await searchCommand(args);
      break;

    case "auth":
      await authCommand(args);
      break;

    case "update":
      await updateCommand(args);
      break;

    default:
      logger.error(
        `Unknown command "${args.command}". Run "skillx --help" for usage.`
      );
      process.exit(1);
  }
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
