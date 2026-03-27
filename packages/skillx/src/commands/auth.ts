import pc from "picocolors";
import type { ParsedArgs } from "../utils/args.js";
import { logger } from "../utils/logger.js";

/**
 * Resolve the GitHub token AND report which source it came from.
 *
 * This differs from the shared `resolveGitHubToken()` in `utils/github.ts`
 * because we need to know the source for display purposes.
 */
async function resolveTokenWithSource(): Promise<{
  token: string;
  source: string;
} | null> {
  // 1. SKILLX_GITHUB_TOKEN
  const skillxToken = process.env.SKILLX_GITHUB_TOKEN;
  if (skillxToken) {
    return { token: skillxToken, source: "SKILLX_GITHUB_TOKEN env var" };
  }

  // 2. GITHUB_TOKEN
  const ghToken = process.env.GITHUB_TOKEN;
  if (ghToken) {
    return { token: ghToken, source: "GITHUB_TOKEN env var" };
  }

  // 3. gh auth token
  try {
    const proc = Bun.spawn(["gh", "auth", "token"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode === 0) {
      const text = await new Response(proc.stdout).text();
      const token = text.trim();
      if (token) {
        return { token, source: "gh auth (GitHub CLI)" };
      }
    }
  } catch {
    // gh CLI not installed or not available — fall through
  }

  return null;
}

/**
 * Check whether the `gh` CLI is installed.
 */
async function isGhCliInstalled(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "gh"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * `skillx auth` — Show authentication status or run `gh auth login`.
 *
 * Subcommands:
 *   (none)   Show current authentication status
 *   login    Launch interactive `gh auth login`
 */
export async function authCommand(args: ParsedArgs): Promise<void> {
  const subcommand = args.positionals[0];

  if (subcommand === "login") {
    await handleLogin();
    return;
  }

  if (subcommand && subcommand !== "status") {
    logger.error(
      `Unknown auth subcommand "${subcommand}". Use ${pc.bold("skillx auth")} or ${pc.bold("skillx auth login")}.`
    );
    process.exit(1);
  }

  // Default: show auth status
  await handleStatus();
}

/**
 * `skillx auth` / `skillx auth status` — Display authentication status.
 */
async function handleStatus(): Promise<void> {
  logger.debug("Resolving GitHub token...");

  const result = await resolveTokenWithSource();

  if (result) {
    const maskedToken =
      result.token.slice(0, 4) + "..." + result.token.slice(-4);
    logger.success(`Authenticated via ${pc.bold(result.source)}`);
    logger.debug(`Token: ${maskedToken}`);
  } else {
    logger.warn("No GitHub token found.");
    console.log();
    console.log("  To authenticate, use one of the following methods:");
    console.log();
    console.log(
      `  ${pc.bold("1.")} Set the ${pc.cyan("SKILLX_GITHUB_TOKEN")} environment variable`
    );
    console.log(
      `  ${pc.bold("2.")} Set the ${pc.cyan("GITHUB_TOKEN")} environment variable`
    );
    console.log(
      `  ${pc.bold("3.")} Install the GitHub CLI and run ${pc.cyan("skillx auth login")}`
    );
    console.log();
    console.log(
      pc.dim(
        "  A GitHub token is required to install skills from private repositories."
      )
    );
    console.log(
      pc.dim("  Public repositories can be accessed without authentication.")
    );
    console.log();
  }
}

/**
 * `skillx auth login` — Launch interactive `gh auth login`.
 */
async function handleLogin(): Promise<void> {
  const ghInstalled = await isGhCliInstalled();

  if (!ghInstalled) {
    logger.error("GitHub CLI (gh) is not installed.");
    console.log();
    console.log("  Install it from: " + pc.cyan("https://cli.github.com"));
    console.log();
    console.log("  Or set a token manually:");
    console.log(
      `    ${pc.dim("export SKILLX_GITHUB_TOKEN=ghp_your_token_here")}`
    );
    console.log(
      `    ${pc.dim("export GITHUB_TOKEN=ghp_your_token_here")}`
    );
    console.log();
    process.exit(1);
  }

  logger.info("Launching GitHub CLI authentication...");
  logger.info(
    pc.dim("This will open an interactive session to authenticate with GitHub.")
  );

  const proc = Bun.spawn(["gh", "auth", "login"], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;

  if (exitCode === 0) {
    logger.success("Successfully authenticated with GitHub!");
  } else {
    logger.error(`gh auth login exited with code ${exitCode}.`);
    process.exit(1);
  }
}
