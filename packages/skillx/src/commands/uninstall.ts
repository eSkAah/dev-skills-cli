import type { ParsedArgs } from "../utils/args.js";
import { logger } from "../utils/logger.js";

export async function uninstallCommand(args: ParsedArgs): Promise<void> {
  const skillName = args.positionals[0];

  if (!skillName) {
    logger.error("Missing skill name. Usage: skillx uninstall <name>");
    process.exit(1);
  }

  logger.info(`uninstall command called for skill: ${skillName}`);
  logger.debug(`flags: ${JSON.stringify(args.flags)}`);

  // TODO: T-013 — implement uninstall flow
  // read lockfile -> platform.uninstall() -> update project manifest -> update lockfile
  logger.warn("uninstall command is not yet implemented");
}
