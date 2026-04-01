import { mkdir, readdir, readFile, rm, stat, cp } from "fs/promises";
import { join, relative, dirname } from "path";
import { parse as parseYaml } from "yaml";
import type {
  InstalledFiles,
  SkillManifest,
  ValidationResult,
} from "../types.js";
import { type Platform, registerPlatform } from "./platform.js";
import { injectClaudeMd, removeClaudeMd } from "../core/claudemd.js";

/** Directory names used by Claude Code */
const CLAUDE_DIR = ".claude";
const SKILLS_DIR = "skills";
const AGENTS_DIR = "agents";
const SKILL_FILE = "SKILL.md";

/**
 * Parse YAML frontmatter from a markdown file.
 * Expects the file to start with `---` and end frontmatter with `---`.
 *
 * @returns Parsed frontmatter object, or null if no valid frontmatter found
 */
function parseFrontmatter(
  content: string,
): Record<string, unknown> | null {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) {
    return null;
  }

  const endIndex = trimmed.indexOf("---", 3);
  if (endIndex === -1) {
    return null;
  }

  const yamlContent = trimmed.slice(3, endIndex).trim();
  if (!yamlContent) {
    return null;
  }

  try {
    const parsed = parseYaml(yamlContent);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
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
 * Recursively collect all file paths under a directory (relative to the directory).
 */
async function collectFiles(
  dir: string,
  base: string = dir,
): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, base)));
    } else {
      files.push(relative(base, fullPath));
    }
  }

  return files;
}

/**
 * Remove a directory if it is empty, then check its parent, recursively.
 * Stops at the given boundary directory (will not remove the boundary itself).
 */
async function removeEmptyParents(
  dir: string,
  boundary: string,
): Promise<void> {
  // Don't go above the boundary
  if (dir === boundary || !dir.startsWith(boundary)) {
    return;
  }

  try {
    const entries = await readdir(dir);
    if (entries.length === 0) {
      await rm(dir, { recursive: true });
      await removeEmptyParents(dirname(dir), boundary);
    }
  } catch {
    // Directory may already be gone or inaccessible — ignore
  }
}

/**
 * Claude Code platform implementation.
 *
 * Manages skills in `.claude/skills/` and agents in `.claude/agents/`
 * within the project root.
 */
const claudePlatform: Platform = {
  name: "claude",

  /**
   * Detect if Claude Code is used in the project by checking
   * for the existence of the `.claude/` directory.
   */
  async detect(projectRoot: string): Promise<boolean> {
    return pathExists(join(projectRoot, CLAUDE_DIR));
  },

  /**
   * Install skill files into the project's `.claude/` directory.
   *
   * - Reads `claude.skills` paths from the manifest and copies each skill
   *   directory into `.claude/skills/` at the project root.
   * - Reads `claude.agents` paths from the manifest and copies each agent
   *   file into `.claude/agents/` at the project root.
   * - Handles sub-skills via recursive directory copy.
   *
   * @returns List of all files created (paths relative to projectRoot)
   */
  async install(
    skillManifest: SkillManifest,
    skillDir: string,
    projectRoot: string,
  ): Promise<InstalledFiles> {
    const installedFiles: string[] = [];
    const claudeConfig = skillManifest.claude;

    if (!claudeConfig) {
      return { platform: "claude", files: [] };
    }

    // Install skills
    if (claudeConfig.skills && claudeConfig.skills.length > 0) {
      const skillsDestBase = join(projectRoot, CLAUDE_DIR, SKILLS_DIR);
      await mkdir(skillsDestBase, { recursive: true });

      for (const skillPath of claudeConfig.skills) {
        const srcPath = join(skillDir, skillPath);

        if (!(await pathExists(srcPath))) {
          continue;
        }

        const srcStat = await stat(srcPath);

        if (srcStat.isDirectory()) {
          // For a directory like "claude/skills/", copy each child
          // (each child is a skill folder) into .claude/skills/
          const entries = await readdir(srcPath, { withFileTypes: true });

          for (const entry of entries) {
            const entrySrc = join(srcPath, entry.name);
            const entryDest = join(skillsDestBase, entry.name);

            if (entry.isDirectory()) {
              // Recursively copy the skill directory
              await cp(entrySrc, entryDest, { recursive: true });

              // Collect all installed files
              const files = await collectFiles(entryDest);
              for (const file of files) {
                installedFiles.push(
                  relative(
                    projectRoot,
                    join(entryDest, file),
                  ),
                );
              }
            } else {
              // Single file at skills root (unusual but supported)
              await mkdir(dirname(entryDest), { recursive: true });
              await cp(entrySrc, entryDest);
              installedFiles.push(relative(projectRoot, entryDest));
            }
          }
        } else {
          // Single file path — copy directly
          const destPath = join(
            skillsDestBase,
            relative(skillDir, srcPath),
          );
          await mkdir(dirname(destPath), { recursive: true });
          await cp(srcPath, destPath);
          installedFiles.push(relative(projectRoot, destPath));
        }
      }
    }

    // Install agents
    if (claudeConfig.agents && claudeConfig.agents.length > 0) {
      const agentsDestBase = join(projectRoot, CLAUDE_DIR, AGENTS_DIR);
      await mkdir(agentsDestBase, { recursive: true });

      for (const agentPath of claudeConfig.agents) {
        const srcPath = join(skillDir, agentPath);

        if (!(await pathExists(srcPath))) {
          continue;
        }

        const srcStat = await stat(srcPath);

        if (srcStat.isDirectory()) {
          // Copy all agent files from the directory
          const entries = await readdir(srcPath, { withFileTypes: true });

          for (const entry of entries) {
            const entrySrc = join(srcPath, entry.name);
            const entryDest = join(agentsDestBase, entry.name);

            if (entry.isDirectory()) {
              await cp(entrySrc, entryDest, { recursive: true });
              const files = await collectFiles(entryDest);
              for (const file of files) {
                installedFiles.push(
                  relative(
                    projectRoot,
                    join(entryDest, file),
                  ),
                );
              }
            } else {
              await cp(entrySrc, entryDest);
              installedFiles.push(relative(projectRoot, entryDest));
            }
          }
        } else {
          // Single agent file
          const destPath = join(agentsDestBase, relative(skillDir, srcPath));
          await mkdir(dirname(destPath), { recursive: true });
          await cp(srcPath, destPath);
          installedFiles.push(relative(projectRoot, destPath));
        }
      }
    }

    // Inject CLAUDE.md entries if declared in manifest
    if (claudeConfig.claudemd?.entries && claudeConfig.claudemd.entries.length > 0) {
      const claudeMdFiles = await injectClaudeMd(
        projectRoot,
        skillManifest.name,
        claudeConfig.claudemd.entries,
      );
      installedFiles.push(...claudeMdFiles);
    }

    return { platform: "claude", files: installedFiles };
  },

  /**
   * Uninstall skill files from the project.
   *
   * Deletes each file/directory listed in `installedFiles` (paths relative
   * to projectRoot), then cleans up any empty parent directories up to
   * the `.claude/` boundary. Also removes any CLAUDE.md injected sections.
   */
  async uninstall(
    skillName: string,
    installedFiles: string[],
    projectRoot: string,
  ): Promise<void> {
    const claudeRoot = join(projectRoot, CLAUDE_DIR);

    for (const filePath of installedFiles) {
      // Skip CLAUDE.md — it is handled separately by removeClaudeMd
      if (filePath === "CLAUDE.md") {
        continue;
      }

      const fullPath = join(projectRoot, filePath);

      if (await pathExists(fullPath)) {
        const fileStat = await stat(fullPath);
        await rm(fullPath, {
          recursive: fileStat.isDirectory(),
        });

        // Clean up empty parent directories
        await removeEmptyParents(dirname(fullPath), claudeRoot);
      }
    }

    // Remove any CLAUDE.md injected sections for this skill
    await removeClaudeMd(projectRoot, skillName);
  },

  /**
   * List skills installed in `.claude/skills/`.
   *
   * Scans for directories containing `SKILL.md`, parses YAML frontmatter
   * to extract `name` and `description`.
   */
  async list(
    projectRoot: string,
  ): Promise<Array<{ name: string; description: string; path: string }>> {
    const skillsDir = join(projectRoot, CLAUDE_DIR, SKILLS_DIR);
    const results: Array<{
      name: string;
      description: string;
      path: string;
    }> = [];

    if (!(await pathExists(skillsDir))) {
      return results;
    }

    const entries = await readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillMdPath = join(skillsDir, entry.name, SKILL_FILE);
      if (!(await pathExists(skillMdPath))) {
        continue;
      }

      const content = await readFile(skillMdPath, "utf-8");
      const frontmatter = parseFrontmatter(content);

      results.push({
        name:
          (frontmatter?.name as string) || entry.name,
        description:
          (frontmatter?.description as string) || "",
        path: relative(projectRoot, join(skillsDir, entry.name)),
      });
    }

    return results;
  },

  /**
   * Validate a skill directory for Claude Code compatibility.
   *
   * Checks that:
   * - The directory contains valid `SKILL.md` files
   * - Each `SKILL.md` has parsable YAML frontmatter
   * - Frontmatter includes required `name` and `description` fields
   */
  async validate(skillDir: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Find all SKILL.md files in the directory tree
    const skillFiles = await findSkillFiles(skillDir);

    if (skillFiles.length === 0) {
      errors.push(
        `No ${SKILL_FILE} files found in "${skillDir}".`,
      );
      return { valid: false, errors, warnings };
    }

    for (const skillFile of skillFiles) {
      const relativePath = relative(skillDir, skillFile);
      let content: string;

      try {
        content = await readFile(skillFile, "utf-8");
      } catch {
        errors.push(`Cannot read file: ${relativePath}`);
        continue;
      }

      const frontmatter = parseFrontmatter(content);

      if (!frontmatter) {
        errors.push(
          `${relativePath}: Missing or invalid YAML frontmatter.`,
        );
        continue;
      }

      if (!frontmatter.name || typeof frontmatter.name !== "string") {
        errors.push(
          `${relativePath}: Frontmatter is missing required "name" field.`,
        );
      }

      if (
        !frontmatter.description ||
        typeof frontmatter.description !== "string"
      ) {
        errors.push(
          `${relativePath}: Frontmatter is missing required "description" field.`,
        );
      }

      // Optional warnings
      if (frontmatter.name && typeof frontmatter.name === "string") {
        if (frontmatter.name.includes(" ")) {
          warnings.push(
            `${relativePath}: Skill name "${frontmatter.name}" contains spaces. Consider using kebab-case.`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },
};

/**
 * Recursively find all SKILL.md files in a directory tree.
 */
async function findSkillFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  if (!(await pathExists(dir))) {
    return results;
  }

  const dirStat = await stat(dir);
  if (!dirStat.isDirectory()) {
    return results;
  }

  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findSkillFiles(fullPath)));
    } else if (entry.name === SKILL_FILE) {
      results.push(fullPath);
    }
  }

  return results;
}

// Self-register with the platform registry
registerPlatform("claude", () => claudePlatform);

export default claudePlatform;
