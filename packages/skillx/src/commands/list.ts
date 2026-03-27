import pc from "picocolors";
import type { ParsedArgs } from "../utils/args.js";
import { logger } from "../utils/logger.js";
import { readProjectManifest } from "../core/project-manifest.js";
import { readLockfile } from "../core/lockfile.js";
import type { PlatformName, ProjectSkillEntry } from "../types.js";

/**
 * Format a platform name as a colored badge.
 */
function platformBadge(platform: PlatformName): string {
  switch (platform) {
    case "claude":
      return pc.cyan(platform);
    case "codex":
      return pc.magenta(platform);
    default:
      return pc.gray(platform);
  }
}

/**
 * `skillx list` — Display installed skills from the project manifest.
 *
 * Flags:
 *   --verbose   Also show installed files from lockfile
 *   --platform  Filter to only show skills for a specific platform
 */
export async function listCommand(args: ParsedArgs): Promise<void> {
  const projectRoot = process.cwd();

  logger.debug("Reading project manifest...");
  const manifest = await readProjectManifest(projectRoot);

  // Collect skill entries, optionally filtering by platform
  const platformFilter = args.flags.platform;
  let entries: [string, ProjectSkillEntry][] = Object.entries(manifest.skills);

  if (platformFilter && platformFilter !== "all") {
    entries = entries.filter(([, entry]) =>
      entry.platforms.includes(platformFilter as PlatformName)
    );
  }

  // No skills installed (or none match filter)
  if (entries.length === 0) {
    if (platformFilter && platformFilter !== "all") {
      logger.info(
        `No skills installed for platform "${platformFilter}". Run ${pc.bold("skillx install <source>")} to get started.`
      );
    } else {
      logger.info(
        `No skills installed. Run ${pc.bold("skillx install <source>")} to get started.`
      );
    }
    return;
  }

  // Compute column widths for aligned table output
  const nameWidth = Math.max(...entries.map(([name]) => name.length));
  const versionWidth = Math.max(
    ...entries.map(([, entry]) => entry.version.length)
  );
  const sourceWidth = Math.max(
    ...entries.map(([, entry]) => entry.source.length)
  );

  console.log();
  console.log(pc.bold(`Installed skills (${entries.length}):`));
  console.log();

  for (const [name, entry] of entries) {
    const nameCol = pc.bold(name.padEnd(nameWidth));
    const versionCol = pc.dim(entry.version.padEnd(versionWidth));
    const sourceCol = pc.dim(entry.source.padEnd(sourceWidth));
    const platformsCol = entry.platforms.map(platformBadge).join(" ");

    console.log(`  ${nameCol}  ${versionCol}  ${sourceCol}  ${platformsCol}`);
  }

  console.log();

  // --verbose: also show installed files from the lockfile
  if (args.flags.verbose) {
    logger.debug("Reading lockfile for file details...");
    const lockfile = await readLockfile(projectRoot);

    let hasLockData = false;

    for (const [name] of entries) {
      const lockEntry = lockfile.skills[name];
      if (!lockEntry) continue;

      hasLockData = true;
      console.log(pc.bold(`  ${name}`) + pc.dim(` (installed ${lockEntry.installedAt})`));
      console.log(pc.dim(`    resolved: ${lockEntry.resolved}`));
      console.log(pc.dim(`    sha: ${lockEntry.sha}`));

      for (const [platform, files] of Object.entries(lockEntry.files)) {
        if (files.length === 0) continue;
        console.log(pc.dim(`    ${platform}:`));
        for (const file of files) {
          console.log(pc.dim(`      - ${file}`));
        }
      }

      console.log();
    }

    if (!hasLockData) {
      logger.warn("No lockfile data found. Run skillx install to regenerate.");
    }
  }
}
