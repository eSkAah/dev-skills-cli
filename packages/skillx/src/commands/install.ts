import type { ParsedArgs } from "../utils/args.js";
import type { InstalledFiles, LockfileEntry, PlatformName, SkillManifest } from "../types.js";
import { logger } from "../utils/logger.js";
import { parseSpecifier, resolveDownloadUrl } from "../core/resolver.js";
import { resolveGitHubToken } from "../utils/github.js";
import { downloadAndExtract, cleanup } from "../core/downloader.js";
import { readSkillManifest, getSkillFromMonorepo } from "../core/manifest.js";
import { validateSkillManifest } from "../core/validator.js";
import { readProjectManifest, addSkill } from "../core/project-manifest.js";
import { addLockEntry } from "../core/lockfile.js";
import { getPlatform } from "../platforms/platform.js";

export async function installCommand(args: ParsedArgs): Promise<void> {
  const specifier = args.positionals[0];

  if (!specifier) {
    logger.error("Missing skill specifier. Usage: skillx install <user/repo>");
    process.exit(1);
  }

  // 1. Parse the specifier
  let spec;
  try {
    spec = parseSpecifier(specifier);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const source = `${spec.owner}/${spec.repo}`;

  // 2. Check if skill is already installed (unless --force)
  if (!args.flags.force) {
    const projectManifest = await readProjectManifest(projectRoot);
    // We'll check after we know the skill name, but we can pre-check by source
    const existingSkills = Object.entries(projectManifest.skills);
    const alreadyInstalled = existingSkills.find(
      ([, entry]) => entry.source === source,
    );
    if (alreadyInstalled) {
      logger.warn(
        `Skill "${alreadyInstalled[0]}" from ${source} is already installed. Use --force to reinstall.`,
      );
      process.exit(1);
    }
  }

  let extractedDir: string | undefined;

  try {
    // 3. Resolve GitHub token
    const spinner1 = logger.spinner("Resolving skill...");
    let token: string | undefined;
    try {
      const resolved = await resolveGitHubToken();
      token = resolved ?? undefined;
    } catch {
      // Continue without token — will fail on private repos
    }

    // 4. Resolve download URL
    let url: string;
    let sha: string;
    try {
      const result = await resolveDownloadUrl(spec, token);
      url = result.url;
      sha = result.sha;
      spinner1.stop("Skill resolved");
    } catch (err) {
      spinner1.stop("Failed to resolve skill");
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to resolve ${source}: ${message}`);
      if (!token) {
        logger.info(
          "Hint: If this is a private repo, authenticate with: skillx auth login",
        );
      }
      process.exit(1);
    }

    // 5. Download and extract
    const spinner2 = logger.spinner("Downloading...");
    try {
      extractedDir = await downloadAndExtract(url, token);
      spinner2.stop("Downloaded and extracted");
    } catch (err) {
      spinner2.stop("Download failed");
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to download skill: ${message}`);
      if (!token) {
        logger.info(
          "Hint: If this is a private repo, authenticate with: skillx auth login",
        );
      }
      process.exit(1);
    }

    // 6. Read the skill manifest
    let manifest: SkillManifest;
    try {
      manifest = await readSkillManifest(extractedDir);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
      process.exit(1);
    }

    // 7. Handle monorepo: extract specific skill if requested
    let skillDir = extractedDir;
    if (manifest.monorepo && spec.skillName) {
      const subSkill = getSkillFromMonorepo(manifest, spec.skillName);
      if (!subSkill) {
        logger.error(
          `Skill "${spec.skillName}" not found in monorepo ${source}. ` +
            `Available skills: ${manifest.skills?.map((s) => s.name).join(", ") ?? "none"}`,
        );
        process.exit(1);
      }
      manifest = subSkill;
    } else if (manifest.monorepo && !spec.skillName) {
      logger.error(
        `${source} is a monorepo. Specify a skill name: skillx install ${source}:<skill-name>\n` +
          `Available skills: ${manifest.skills?.map((s) => s.name).join(", ") ?? "none"}`,
      );
      process.exit(1);
    }

    // 8. Validate the manifest
    const validation = await validateSkillManifest(manifest, skillDir);

    for (const warning of validation.warnings) {
      logger.warn(warning);
    }

    if (!validation.valid) {
      for (const error of validation.errors) {
        logger.error(error);
      }
      logger.error("Skill manifest validation failed. Aborting installation.");
      process.exit(1);
    }

    // 9. Also check by name if already installed (now that we know the name)
    if (!args.flags.force) {
      const projectManifest = await readProjectManifest(projectRoot);
      if (manifest.name in projectManifest.skills) {
        logger.warn(
          `Skill "${manifest.name}" is already installed. Use --force to reinstall.`,
        );
        process.exit(1);
      }
    }

    // 10. Determine target platforms
    let targetPlatforms: PlatformName[];
    if (args.flags.platform && args.flags.platform !== "all") {
      targetPlatforms = [args.flags.platform as PlatformName];
    } else {
      targetPlatforms = manifest.platforms;
    }

    // 11. Install for each platform
    const allInstalledFiles: InstalledFiles[] = [];
    const installedPlatforms: PlatformName[] = [];

    for (const platformName of targetPlatforms) {
      const spinner3 = logger.spinner(`Installing for ${platformName}...`);
      try {
        const platform = await getPlatform(platformName);
        const installedFiles = await platform.install(
          manifest,
          skillDir,
          projectRoot,
        );
        allInstalledFiles.push(installedFiles);
        installedPlatforms.push(platformName);
        spinner3.stop(`Installed for ${platformName}`);
      } catch (err) {
        spinner3.stop(`Failed to install for ${platformName}`);
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Platform "${platformName}" install failed: ${message}`);
        process.exit(1);
      }
    }

    // 12. Build the files map for the lockfile entry
    const filesMap: Record<PlatformName, string[]> = {} as Record<
      PlatformName,
      string[]
    >;
    for (const installed of allInstalledFiles) {
      filesMap[installed.platform] = installed.files;
    }

    // 13. Update project manifest
    await addSkill(projectRoot, {
      name: manifest.name,
      source,
      version: manifest.version,
      platforms: installedPlatforms,
    });

    // 14. Update lockfile
    const lockEntry: LockfileEntry = {
      source,
      version: manifest.version,
      resolved: url,
      sha,
      installedAt: new Date().toISOString(),
      files: filesMap,
    };
    await addLockEntry(projectRoot, manifest.name, lockEntry);

    // 15. Success message
    const totalFiles = allInstalledFiles.reduce(
      (sum, i) => sum + i.files.length,
      0,
    );
    logger.success(
      `Installed "${manifest.name}" v${manifest.version} for ${installedPlatforms.join(", ")} (${totalFiles} file${totalFiles !== 1 ? "s" : ""})`,
    );
  } finally {
    // 16. Always cleanup temp directory
    if (extractedDir) {
      await cleanup(extractedDir);
    }
  }
}
