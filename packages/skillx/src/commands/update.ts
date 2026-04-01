import pc from "picocolors";
import type { ParsedArgs } from "../utils/args.js";
import type { InstalledFiles, LockfileEntry, PlatformName, SkillManifest } from "../types.js";
import { logger } from "../utils/logger.js";
import { readProjectManifest, addSkill } from "../core/project-manifest.js";
import { readLockfile, getLockEntry, addLockEntry } from "../core/lockfile.js";
import { parseSpecifier, resolveDownloadUrl } from "../core/resolver.js";
import { resolveGitHubToken } from "../utils/github.js";
import { downloadAndExtract, cleanup } from "../core/downloader.js";
import { readSkillManifest, getSkillFromMonorepo } from "../core/manifest.js";
import { validateSkillManifest } from "../core/validator.js";
import { getPlatform, detectPlatforms } from "../platforms/platform.js";

/**
 * Information about a skill that has an available update.
 */
interface UpdateCandidate {
  name: string;
  source: string;
  currentSha: string;
  latestSha: string;
  latestUrl: string;
  token?: string;
}

/**
 * `skillx update` — Check for and apply updates to installed skills.
 *
 * Usage:
 *   skillx update              Update all installed skills
 *   skillx update <name>       Update a specific skill
 *   skillx update --check      Dry run — show which skills have updates available
 */
export async function updateCommand(args: ParsedArgs): Promise<void> {
  const skillName = args.positionals[0];
  const projectRoot = process.cwd();
  const isDryRun = args.flags.check;

  if (skillName) {
    // --- Single skill update ---
    await updateSingleSkill(skillName, projectRoot, isDryRun, args);
  } else {
    // --- Update all skills ---
    await updateAllSkills(projectRoot, isDryRun, args);
  }
}

/**
 * Update a single named skill.
 */
async function updateSingleSkill(
  skillName: string,
  projectRoot: string,
  isDryRun: boolean,
  args: ParsedArgs,
): Promise<void> {
  // 1. Check the lockfile for the skill
  const lockEntry = await getLockEntry(projectRoot, skillName);

  if (!lockEntry) {
    logger.error(
      `Skill "${skillName}" is not installed. Use ${pc.bold("skillx install")} to install it first.`,
    );
    process.exit(1);
  }

  // 2. Check for update
  const spinner = logger.spinner(`Checking "${skillName}" for updates...`);
  let candidate: UpdateCandidate | null;

  try {
    candidate = await checkForUpdate(skillName, lockEntry);
    spinner.stop(`Checked "${skillName}"`);
  } catch (err) {
    spinner.stop(`Failed to check "${skillName}"`);
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to check for updates: ${message}`);
    process.exit(1);
  }

  if (!candidate) {
    logger.success(`"${skillName}" is already up to date.`);
    return;
  }

  // 3. Dry run — just display and exit
  if (isDryRun) {
    console.log();
    console.log(pc.bold("Update available:"));
    console.log();
    printUpdateCandidate(candidate);
    console.log();
    return;
  }

  // 4. Apply the update
  await applyUpdate(candidate, projectRoot, args);
  logger.success(`Updated 1 skill`);
}

/**
 * Update all installed skills.
 */
async function updateAllSkills(
  projectRoot: string,
  isDryRun: boolean,
  args: ParsedArgs,
): Promise<void> {
  // 1. Read the project manifest to get the list of installed skills
  const manifest = await readProjectManifest(projectRoot);
  const skillNames = Object.keys(manifest.skills);

  if (skillNames.length === 0) {
    logger.info(
      `No skills installed. Use ${pc.bold("skillx install <source>")} to install skills.`,
    );
    return;
  }

  // 2. Read the lockfile
  const lockfile = await readLockfile(projectRoot);

  // 3. Check each skill for updates
  const spinner = logger.spinner(
    `Checking ${skillNames.length} skill${skillNames.length !== 1 ? "s" : ""} for updates...`,
  );

  const candidates: UpdateCandidate[] = [];

  for (const name of skillNames) {
    const lockEntry = lockfile.skills[name];
    if (!lockEntry) {
      logger.debug(`Skill "${name}" has no lockfile entry — skipping.`);
      continue;
    }

    try {
      const candidate = await checkForUpdate(name, lockEntry);
      if (candidate) {
        candidates.push(candidate);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Failed to check "${name}" for updates: ${message}`);
    }
  }

  spinner.stop(
    `Checked ${skillNames.length} skill${skillNames.length !== 1 ? "s" : ""}`,
  );

  // 4. No updates available
  if (candidates.length === 0) {
    logger.success("All skills are up to date.");
    return;
  }

  // 5. Dry run — display available updates and exit
  if (isDryRun) {
    console.log();
    console.log(
      pc.bold(
        `${candidates.length} update${candidates.length !== 1 ? "s" : ""} available:`,
      ),
    );
    console.log();
    for (const candidate of candidates) {
      printUpdateCandidate(candidate);
    }
    console.log();
    return;
  }

  // 6. Apply updates
  let updatedCount = 0;

  for (const candidate of candidates) {
    try {
      await applyUpdate(candidate, projectRoot, args);
      updatedCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to update "${candidate.name}": ${message}`);
    }
  }

  if (updatedCount > 0) {
    logger.success(
      `Updated ${updatedCount} skill${updatedCount !== 1 ? "s" : ""}`,
    );
  } else {
    logger.error("No skills were updated due to errors.");
    process.exit(1);
  }
}

/**
 * Check if a skill has an available update by comparing the lockfile SHA
 * with the latest commit SHA on GitHub.
 *
 * Returns an UpdateCandidate if an update is available, or null if up to date.
 */
async function checkForUpdate(
  name: string,
  lockEntry: LockfileEntry,
): Promise<UpdateCandidate | null> {
  const spec = parseSpecifier(lockEntry.source);

  // Resolve GitHub token
  let token: string | undefined;
  try {
    const resolved = await resolveGitHubToken();
    token = resolved ?? undefined;
  } catch {
    // Continue without token
  }

  // Resolve the latest commit SHA
  const { url, sha } = await resolveDownloadUrl(spec, token);

  // Compare SHAs
  if (sha === lockEntry.sha) {
    return null;
  }

  return {
    name,
    source: lockEntry.source,
    currentSha: lockEntry.sha,
    latestSha: sha,
    latestUrl: url,
    token,
  };
}

/**
 * Apply an update by running the full install flow for a skill.
 * Downloads, extracts, validates, installs, and updates manifest + lockfile.
 */
async function applyUpdate(
  candidate: UpdateCandidate,
  projectRoot: string,
  args: ParsedArgs,
): Promise<void> {
  const { name, source, latestUrl, latestSha, token } = candidate;

  const spinner = logger.spinner(`Updating "${name}"...`);
  let extractedDir: string | undefined;

  try {
    // 1. Download and extract
    extractedDir = await downloadAndExtract(latestUrl, token);

    // 2. Read the skill manifest
    let manifest: SkillManifest;
    try {
      manifest = await readSkillManifest(extractedDir);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read manifest: ${message}`);
    }

    // 3. Handle monorepo
    const spec = parseSpecifier(source);
    let skillDir = extractedDir;
    if (manifest.monorepo && spec.skillName) {
      const subSkill = getSkillFromMonorepo(manifest, spec.skillName);
      if (!subSkill) {
        throw new Error(
          `Skill "${spec.skillName}" not found in monorepo ${source}.`,
        );
      }
      manifest = subSkill;
    } else if (manifest.monorepo && !spec.skillName) {
      // For update, the name from the lockfile should match a skill in the monorepo
      const subSkill = getSkillFromMonorepo(manifest, name);
      if (!subSkill) {
        throw new Error(
          `Skill "${name}" not found in monorepo ${source}.`,
        );
      }
      manifest = subSkill;
    }

    // 4. Validate the manifest
    const validation = await validateSkillManifest(manifest, skillDir);

    for (const warning of validation.warnings) {
      logger.warn(warning);
    }

    if (!validation.valid) {
      throw new Error(
        `Manifest validation failed: ${validation.errors.join(", ")}`,
      );
    }

    // 5. Determine target platforms (respects --platform flag)
    let targetPlatforms: PlatformName[];
    if (args.flags.platform && args.flags.platform !== "all") {
      const requested = args.flags.platform as PlatformName;
      if (!manifest.platforms.includes(requested)) {
        throw new Error(
          `Skill "${manifest.name}" does not support platform "${requested}". Supported platforms: ${manifest.platforms.join(", ")}`,
        );
      }
      targetPlatforms = [requested];
    } else if (args.flags.platform === "all") {
      targetPlatforms = manifest.platforms;
    } else {
      // No flag → auto-detect, same logic as install
      const detected = await detectPlatforms(projectRoot);
      if (detected.length > 0) {
        targetPlatforms = detected.filter((p) => manifest.platforms.includes(p));
        if (targetPlatforms.length === 0) {
          targetPlatforms = manifest.platforms;
        }
      } else {
        targetPlatforms = manifest.platforms;
      }
    }

    // 6. Install for each platform (overwrites existing files)
    const allInstalledFiles: InstalledFiles[] = [];
    const installedPlatforms: PlatformName[] = [];

    for (const platformName of targetPlatforms) {
      try {
        const platform = await getPlatform(platformName);
        const installedFiles = await platform.install(
          manifest,
          skillDir,
          projectRoot,
        );
        allInstalledFiles.push(installedFiles);
        installedPlatforms.push(platformName);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Platform "${platformName}" install failed: ${message}`,
        );
      }
    }

    // 7. Build the files map for the lockfile entry
    const filesMap: Record<PlatformName, string[]> = {} as Record<
      PlatformName,
      string[]
    >;
    for (const installed of allInstalledFiles) {
      filesMap[installed.platform] = installed.files;
    }

    // 8. Update project manifest
    await addSkill(projectRoot, {
      name: manifest.name,
      source,
      version: manifest.version,
      platforms: installedPlatforms,
    });

    // 9. Update lockfile
    const lockEntry: LockfileEntry = {
      source,
      version: manifest.version,
      resolved: latestUrl,
      sha: latestSha,
      installedAt: new Date().toISOString(),
      files: filesMap,
    };
    await addLockEntry(projectRoot, manifest.name, lockEntry);

    spinner.stop(
      `Updated "${name}" ${pc.dim(`(${candidate.currentSha.slice(0, 7)} -> ${latestSha.slice(0, 7)})`)}`,
    );
  } catch (err) {
    spinner.stop(`Failed to update "${name}"`);
    throw err;
  } finally {
    // Always cleanup temp directory
    if (extractedDir) {
      await cleanup(extractedDir);
    }
  }
}

/**
 * Print a single update candidate to the console.
 */
function printUpdateCandidate(candidate: UpdateCandidate): void {
  const shortCurrent = candidate.currentSha.slice(0, 7);
  const shortLatest = candidate.latestSha.slice(0, 7);
  console.log(
    `  ${pc.bold(candidate.name)}  ${pc.dim(candidate.source)}  ${pc.red(shortCurrent)} ${pc.dim("->")} ${pc.green(shortLatest)}`,
  );
}
