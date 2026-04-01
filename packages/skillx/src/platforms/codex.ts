import { mkdir, readdir, readFile, rm, stat, writeFile, cp } from "fs/promises";
import { join, basename, relative } from "path";
import type {
  InstalledFiles,
  SkillManifest,
  ValidationResult,
} from "../types.js";
import { type Platform, registerPlatform } from "./platform.js";

/** Codex convention: AGENTS.md at project root */
const AGENTS_MD = "AGENTS.md";

/** Codex agents directory */
const CODEX_DIR = ".codex";
const CODEX_AGENTS_DIR = "agents";

/** Section marker templates */
function startMarker(skillName: string): string {
  return `<!-- skillx:${skillName}:start -->`;
}

function endMarker(skillName: string): string {
  return `<!-- skillx:${skillName}:end -->`;
}

/**
 * Check if a path exists on disk.
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read AGENTS.md content, or return empty string if it doesn't exist.
 */
async function readAgentsMd(projectRoot: string): Promise<string> {
  const agentsMdPath = join(projectRoot, AGENTS_MD);
  if (!(await pathExists(agentsMdPath))) {
    return "";
  }
  return readFile(agentsMdPath, "utf-8");
}

/**
 * Write content to AGENTS.md at the project root.
 */
async function writeAgentsMd(
  projectRoot: string,
  content: string,
): Promise<void> {
  const agentsMdPath = join(projectRoot, AGENTS_MD);
  await writeFile(agentsMdPath, content, "utf-8");
}

/**
 * Extract the first non-empty line from a block of content.
 * Used as a short description for listing installed skills.
 */
function firstContentLine(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("<!--")) {
      return trimmed;
    }
  }
  return "";
}

/**
 * Insert or replace a skill section in AGENTS.md content.
 *
 * If a section with matching markers already exists, its content is replaced.
 * Otherwise, the new section is appended at the end.
 */
function upsertSection(
  existingContent: string,
  skillName: string,
  sectionContent: string,
): string {
  const start = startMarker(skillName);
  const end = endMarker(skillName);
  const newSection = `${start}\n${sectionContent}\n${end}`;

  const startIdx = existingContent.indexOf(start);
  const endIdx = existingContent.indexOf(end);

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing section (including markers)
    const before = existingContent.slice(0, startIdx);
    const after = existingContent.slice(endIdx + end.length);
    return before + newSection + after;
  }

  // Append new section
  if (existingContent.length > 0 && !existingContent.endsWith("\n")) {
    return existingContent + "\n\n" + newSection + "\n";
  }

  if (existingContent.length > 0) {
    return existingContent + "\n" + newSection + "\n";
  }

  return newSection + "\n";
}

/**
 * Remove a skill section from AGENTS.md content.
 * Returns the cleaned content with the section and its markers removed.
 */
function removeSection(content: string, skillName: string): string {
  const start = startMarker(skillName);
  const end = endMarker(skillName);

  const startIdx = content.indexOf(start);
  const endIdx = content.indexOf(end);

  if (startIdx === -1 || endIdx === -1) {
    return content;
  }

  const before = content.slice(0, startIdx);
  const after = content.slice(endIdx + end.length);

  // Clean up: remove trailing whitespace/newlines left behind
  const cleaned = (before.trimEnd() + "\n" + after.trimStart()).trim();

  return cleaned ? cleaned + "\n" : "";
}

/**
 * Codex platform implementation.
 *
 * Manages skills via `AGENTS.md` at the project root (using section markers
 * to delimit each skill's content) and agent TOML files in `.codex/agents/`.
 */
const codexPlatform: Platform = {
  name: "codex",

  /**
   * Detect if Codex is used in the project by checking
   * for the `.codex/` directory OR an `AGENTS.md` file at the project root.
   */
  async detect(projectRoot: string): Promise<boolean> {
    const hasCodexDir = await pathExists(join(projectRoot, CODEX_DIR));
    const hasAgentsMd = await pathExists(join(projectRoot, AGENTS_MD));
    return hasCodexDir || hasAgentsMd;
  },

  /**
   * Install skill files for Codex into the project.
   *
   * - Reads `codex.instructions` path from the manifest to get the AGENTS.md
   *   content from the skill, then merges it into the project's root AGENTS.md
   *   using the configured strategy (section, append, or replace).
   * - Reads `codex.agents` paths from the manifest and copies TOML agent files
   *   into `.codex/agents/` at the project root.
   *
   * @returns List of all files created/modified (paths relative to projectRoot)
   */
  async install(
    skillManifest: SkillManifest,
    skillDir: string,
    projectRoot: string,
  ): Promise<InstalledFiles> {
    const installedFiles: string[] = [];
    const codexConfig = skillManifest.codex;

    if (!codexConfig) {
      return { platform: "codex", files: [] };
    }

    // --- Install instructions into AGENTS.md ---
    if (codexConfig.instructions) {
      const instructionsPath = join(skillDir, codexConfig.instructions);

      if (await pathExists(instructionsPath)) {
        const instructionsContent = await readFile(instructionsPath, "utf-8");
        const strategy = codexConfig.strategy ?? "section";
        const existingContent = await readAgentsMd(projectRoot);

        let newContent: string;

        switch (strategy) {
          case "replace":
            // Destructive: replace entire AGENTS.md
            newContent =
              startMarker(skillManifest.name) +
              "\n" +
              instructionsContent +
              "\n" +
              endMarker(skillManifest.name) +
              "\n";
            break;

          case "append":
            // Append with section markers (same as section for new installs)
            newContent = upsertSection(
              existingContent,
              skillManifest.name,
              instructionsContent,
            );
            break;

          case "section":
          default:
            // Recommended: insert/update section with markers
            newContent = upsertSection(
              existingContent,
              skillManifest.name,
              instructionsContent,
            );
            break;
        }

        await writeAgentsMd(projectRoot, newContent);
        installedFiles.push(AGENTS_MD);
      }
    }

    // --- Install agent TOML files ---
    if (codexConfig.agents && codexConfig.agents.length > 0) {
      const agentsDestBase = join(projectRoot, CODEX_DIR, CODEX_AGENTS_DIR);
      await mkdir(agentsDestBase, { recursive: true });

      for (const agentPath of codexConfig.agents) {
        const srcPath = join(skillDir, agentPath);

        if (!(await pathExists(srcPath))) {
          continue;
        }

        const srcStat = await stat(srcPath);

        if (srcStat.isDirectory()) {
          // Copy all TOML files from the directory
          const entries = await readdir(srcPath, { withFileTypes: true });

          for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith(".toml")) {
              continue;
            }
            const entrySrc = join(srcPath, entry.name);
            const entryDest = join(agentsDestBase, entry.name);
            await cp(entrySrc, entryDest);
            installedFiles.push(
              relative(projectRoot, entryDest),
            );
          }
        } else if (srcPath.endsWith(".toml")) {
          // Single TOML agent file
          const destPath = join(agentsDestBase, basename(srcPath));
          await cp(srcPath, destPath);
          installedFiles.push(relative(projectRoot, destPath));
        }
      }
    }

    return { platform: "codex", files: installedFiles };
  },

  /**
   * Uninstall skill files for Codex from the project.
   *
   * - Reads AGENTS.md and removes the section between the skill's markers.
   * - If AGENTS.md becomes empty, deletes the file.
   * - Deletes any TOML agent files listed in installedFiles.
   * - Cleans up empty `.codex/agents/` directory if applicable.
   */
  async uninstall(
    skillName: string,
    installedFiles: string[],
    projectRoot: string,
  ): Promise<void> {
    // --- Remove section from AGENTS.md ---
    const agentsMdPath = join(projectRoot, AGENTS_MD);

    if (await pathExists(agentsMdPath)) {
      const content = await readFile(agentsMdPath, "utf-8");
      const cleaned = removeSection(content, skillName);

      if (!cleaned || !cleaned.trim()) {
        // AGENTS.md is now empty — delete it
        await rm(agentsMdPath);
      } else {
        await writeFile(agentsMdPath, cleaned, "utf-8");
      }
    }

    // --- Delete TOML agent files ---
    for (const filePath of installedFiles) {
      // Skip AGENTS.md — already handled above
      if (filePath === AGENTS_MD) {
        continue;
      }

      const fullPath = join(projectRoot, filePath);

      if (await pathExists(fullPath)) {
        await rm(fullPath);
      }
    }

    // --- Clean up empty .codex/agents/ directory ---
    const agentsDir = join(projectRoot, CODEX_DIR, CODEX_AGENTS_DIR);
    if (await pathExists(agentsDir)) {
      const entries = await readdir(agentsDir);
      if (entries.length === 0) {
        await rm(agentsDir, { recursive: true });

        // Also clean up .codex/ if now empty
        const codexDir = join(projectRoot, CODEX_DIR);
        if (await pathExists(codexDir)) {
          const codexEntries = await readdir(codexDir);
          if (codexEntries.length === 0) {
            await rm(codexDir, { recursive: true });
          }
        }
      }
    }
  },

  /**
   * List skills installed for Codex.
   *
   * Scans AGENTS.md for `<!-- skillx:SKILLNAME:start -->` markers and
   * extracts skill names and descriptions. Also scans `.codex/agents/`
   * for TOML files.
   */
  async list(
    projectRoot: string,
  ): Promise<Array<{ name: string; description: string; path: string }>> {
    const results: Array<{
      name: string;
      description: string;
      path: string;
    }> = [];

    // --- Parse AGENTS.md for section markers ---
    const agentsMdPath = join(projectRoot, AGENTS_MD);

    if (await pathExists(agentsMdPath)) {
      const content = await readFile(agentsMdPath, "utf-8");
      const markerPattern = /<!-- skillx:(.+?):start -->/g;
      let match: RegExpExecArray | null;

      while ((match = markerPattern.exec(content)) !== null) {
        const skillName = match[1];
        const start = startMarker(skillName);
        const end = endMarker(skillName);

        const startIdx = content.indexOf(start);
        const endIdx = content.indexOf(end);

        let description = "";
        if (startIdx !== -1 && endIdx !== -1) {
          const sectionContent = content.slice(
            startIdx + start.length,
            endIdx,
          ).trim();
          description = firstContentLine(sectionContent);
        }

        results.push({
          name: skillName,
          description,
          path: AGENTS_MD,
        });
      }
    }

    return results;
  },

  /**
   * Validate a skill directory for Codex compatibility.
   *
   * Checks that:
   * - The referenced AGENTS.md / instructions file exists in the skill directory
   * - Any referenced TOML agent files exist
   */
  async validate(skillDir: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Try to load the manifest to find codex config
    let manifest: SkillManifest | null = null;
    const manifestPath = join(skillDir, "skillx.json");

    if (await pathExists(manifestPath)) {
      try {
        const raw = await readFile(manifestPath, "utf-8");
        manifest = JSON.parse(raw) as SkillManifest;
      } catch {
        errors.push("Failed to parse skillx.json in skill directory.");
        return { valid: false, errors, warnings };
      }
    }

    if (!manifest?.codex) {
      errors.push(
        'Skill manifest is missing "codex" configuration section.',
      );
      return { valid: false, errors, warnings };
    }

    const codexConfig = manifest.codex;

    // Validate instructions file
    if (codexConfig.instructions) {
      const instructionsPath = join(skillDir, codexConfig.instructions);
      if (!(await pathExists(instructionsPath))) {
        errors.push(
          `Instructions file not found: "${codexConfig.instructions}"`,
        );
      }
    } else {
      warnings.push(
        'No "codex.instructions" path specified. No AGENTS.md content will be installed.',
      );
    }

    // Validate agent files
    if (codexConfig.agents && codexConfig.agents.length > 0) {
      for (const agentPath of codexConfig.agents) {
        const fullPath = join(skillDir, agentPath);
        if (!(await pathExists(fullPath))) {
          errors.push(
            `Agent file/directory not found: "${agentPath}"`,
          );
        }
      }
    }

    // Validate strategy
    if (codexConfig.strategy) {
      const validStrategies = ["section", "append", "replace"];
      if (!validStrategies.includes(codexConfig.strategy)) {
        errors.push(
          `Invalid strategy: "${codexConfig.strategy}". Must be one of: ${validStrategies.join(", ")}`,
        );
      }

      if (codexConfig.strategy === "replace") {
        warnings.push(
          'Strategy "replace" is destructive and will overwrite the entire AGENTS.md file.',
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },
};

// Self-register with the platform registry
registerPlatform("codex", () => codexPlatform);

export default codexPlatform;
