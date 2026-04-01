import * as clack from "@clack/prompts";
import type { PlatformName } from "../types.js";
import type { ParsedArgs } from "../utils/args.js";
import { logger } from "../utils/logger.js";
import { getLockEntry, removeLockEntry, addLockEntry } from "../core/lockfile.js";
import { removeSkill, addSkill, readProjectManifest } from "../core/project-manifest.js";
import { getPlatform } from "../platforms/platform.js";

export async function uninstallCommand(args: ParsedArgs): Promise<void> {
  const skillName = args.positionals[0];

  if (!skillName) {
    logger.error("Missing skill name. Usage: skillx uninstall <name>");
    process.exit(1);
  }

  const projectRoot = process.cwd();

  // 1. Read the lockfile to find the installed skill
  const lockEntry = await getLockEntry(projectRoot, skillName);

  if (!lockEntry) {
    logger.error(`Skill '${skillName}' is not installed.`);
    process.exit(1);
  }

  // 2. Determine which platforms to uninstall from
  const allPlatforms = Object.keys(lockEntry.files) as PlatformName[];

  let targetPlatforms: PlatformName[];
  if (args.flags.platform && args.flags.platform !== "all") {
    // User specified a single platform
    const requested = args.flags.platform;
    if (!allPlatforms.includes(requested)) {
      logger.error(
        `Skill '${skillName}' is not installed for platform '${requested}'.`,
      );
      process.exit(1);
    }
    targetPlatforms = [requested];
  } else {
    // Uninstall from all platforms in the lock entry
    targetPlatforms = allPlatforms;
  }

  // 3. Confirmation prompt (skip if --force)
  if (!args.flags.force) {
    const platformList = targetPlatforms.join(", ");
    const confirmed = await clack.confirm({
      message: `Uninstall skill '${skillName}' from ${platformList}?`,
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      logger.info("Uninstall cancelled.");
      return;
    }
  }

  // 4. Uninstall files for each target platform
  const spinner = logger.spinner(`Uninstalling '${skillName}'...`);

  try {
    for (const platformName of targetPlatforms) {
      const files = lockEntry.files[platformName] ?? [];

      if (files.length === 0) {
        logger.debug(`No files to remove for platform '${platformName}'.`);
        continue;
      }

      const platform = await getPlatform(platformName);
      await platform.uninstall(skillName, files, projectRoot);
      logger.debug(
        `Removed ${files.length} file(s) for platform '${platformName}'.`,
      );
    }

    // 5. Determine if this is a partial or full uninstall
    const remainingPlatforms = allPlatforms.filter(
      (p) => !targetPlatforms.includes(p),
    );
    const isPartialUninstall = remainingPlatforms.length > 0;

    if (isPartialUninstall) {
      // Partial uninstall: update lockfile to remove only the uninstalled platforms
      const updatedFiles = { ...lockEntry.files };
      for (const p of targetPlatforms) {
        delete updatedFiles[p];
      }
      await addLockEntry(projectRoot, skillName, {
        ...lockEntry,
        files: updatedFiles,
      });

      // Update the project manifest to reflect remaining platforms
      const projectManifest = await readProjectManifest(projectRoot);
      const existingEntry = projectManifest.skills[skillName];
      if (existingEntry) {
        await addSkill(projectRoot, {
          name: skillName,
          source: existingEntry.source,
          version: existingEntry.version,
          platforms: remainingPlatforms,
        });
      }
    } else {
      // Full uninstall: remove the lockfile entry entirely
      await removeLockEntry(projectRoot, skillName);

      // Remove the skill from the project manifest
      try {
        await removeSkill(projectRoot, skillName);
      } catch {
        // Skill may not be in the project manifest (e.g. partial install)
        // — ignore gracefully
        logger.debug(
          `Skill '${skillName}' was not found in the project manifest (already removed or never added).`,
        );
      }
    }

    spinner.stop(`Uninstalled '${skillName}' successfully.`);
    if (isPartialUninstall) {
      logger.success(
        `Skill '${skillName}' has been removed from ${targetPlatforms.join(", ")}. Still installed for: ${remainingPlatforms.join(", ")}`,
      );
    } else {
      logger.success(
        `Skill '${skillName}' has been removed from ${targetPlatforms.join(", ")}.`,
      );
    }
  } catch (err) {
    spinner.stop("Uninstall failed.");
    logger.error(
      `Failed to uninstall '${skillName}': ${(err as Error).message}`,
    );
    process.exit(1);
  }
}
