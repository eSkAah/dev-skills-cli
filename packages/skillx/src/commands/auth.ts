import type { ParsedArgs } from "../utils/args.js";
import { logger } from "../utils/logger.js";

export async function authCommand(args: ParsedArgs): Promise<void> {
  const subcommand = args.positionals[0];

  logger.info(`auth command called${subcommand ? ` with subcommand: ${subcommand}` : ""}`);
  logger.debug(`flags: ${JSON.stringify(args.flags)}`);

  // TODO: T-015 — implement auth flow
  // "skillx auth" -> display auth status
  // "skillx auth login" -> check for gh CLI, run gh auth login
  logger.warn("auth command is not yet implemented");
}
