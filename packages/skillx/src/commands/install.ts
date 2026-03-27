import type { ParsedArgs } from "../utils/args.js";
import { logger } from "../utils/logger.js";

export async function installCommand(args: ParsedArgs): Promise<void> {
  const specifier = args.positionals[0];

  if (!specifier) {
    logger.error("Missing skill specifier. Usage: skillx install <user/repo>");
    process.exit(1);
  }

  logger.info(`install command called with specifier: ${specifier}`);
  logger.debug(`flags: ${JSON.stringify(args.flags)}`);

  // TODO: T-012 — implement full install flow
  // parse specifier -> resolve -> download -> extract -> read manifest
  // -> validate -> install platform -> update project manifest -> update lockfile
  logger.warn("install command is not yet implemented");
}
