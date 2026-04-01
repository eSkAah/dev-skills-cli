import type { PlatformName } from "../types.js";

/** Parsed CLI arguments */
export interface ParsedArgs {
  command: string | null;
  positionals: string[];
  flags: {
    platform: PlatformName | "all" | null;
    verbose: boolean;
    quiet: boolean;
    force: boolean;
    check: boolean;
    help: boolean;
    version: boolean;
  };
}

/** Map short aliases to full command names */
const COMMAND_ALIASES: Record<string, string> = {
  i: "install",
  un: "uninstall",
  ls: "list",
  s: "search",
  up: "update",
};

/**
 * Parse raw CLI arguments (process.argv.slice(2)) into a structured object.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const flags: ParsedArgs["flags"] = {
    platform: null,
    verbose: false,
    quiet: false,
    force: false,
    check: false,
    help: false,
    version: false,
  };

  const positionals: string[] = [];

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--platform" && i + 1 < argv.length) {
      const value = argv[i + 1];
      if (value === "claude" || value === "codex" || value === "all") {
        flags.platform = value;
      }
      i += 2;
      continue;
    }

    if (arg === "--verbose") {
      flags.verbose = true;
      i++;
      continue;
    }

    if (arg === "--quiet") {
      flags.quiet = true;
      i++;
      continue;
    }

    if (arg === "--force") {
      flags.force = true;
      i++;
      continue;
    }

    if (arg === "--check") {
      flags.check = true;
      i++;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      flags.help = true;
      i++;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      flags.version = true;
      i++;
      continue;
    }

    // Skip unknown flags
    if (arg.startsWith("--") || (arg.startsWith("-") && arg.length === 2)) {
      i++;
      continue;
    }

    positionals.push(arg);
    i++;
  }

  // First positional is the command
  const rawCommand = positionals.shift() ?? null;
  const command = rawCommand
    ? COMMAND_ALIASES[rawCommand] ?? rawCommand
    : null;

  return { command, positionals, flags };
}
