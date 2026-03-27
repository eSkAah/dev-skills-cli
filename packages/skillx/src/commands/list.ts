import type { ParsedArgs } from "../utils/args.js";
import { logger } from "../utils/logger.js";

export async function listCommand(args: ParsedArgs): Promise<void> {
  logger.info("list command called");
  logger.debug(`flags: ${JSON.stringify(args.flags)}`);

  // TODO: T-014 — implement list flow
  // read project manifest -> display installed skills
  // if --verbose: include files from lockfile
  logger.warn("list command is not yet implemented");
}
