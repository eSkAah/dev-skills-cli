import { join } from "path";
import { readFile, access } from "fs/promises";
import { readdirSync, statSync } from "fs";
import { parse as parseYaml } from "yaml";
import type { SkillManifest, ValidationResult } from "../types.js";

/** Maximum length for a skill name */
const MAX_NAME_LENGTH = 64;

/** Pattern for valid skill names: lowercase letters, digits, and hyphens */
const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Simple semver-like pattern: major.minor.patch with optional pre-release */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;

/** Valid platform names */
const VALID_PLATFORMS = new Set(["claude", "codex"]);

/**
 * Validates a skill manifest and checks that referenced paths exist on disk.
 */
export async function validateSkillManifest(
  manifest: SkillManifest,
  skillDir: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- Required fields ---

  // name
  if (!manifest.name) {
    errors.push('Missing required field "name".');
  } else if (typeof manifest.name !== "string") {
    errors.push('"name" must be a string.');
  } else {
    if (manifest.name.length > MAX_NAME_LENGTH) {
      errors.push(
        `"name" must be at most ${MAX_NAME_LENGTH} characters (got ${manifest.name.length}).`
      );
    }
    if (!NAME_PATTERN.test(manifest.name)) {
      errors.push(
        `"name" must start with a lowercase letter and contain only lowercase letters, digits, and hyphens. Got "${manifest.name}".`
      );
    }
  }

  // version
  if (!manifest.version) {
    errors.push('Missing required field "version".');
  } else if (typeof manifest.version !== "string") {
    errors.push('"version" must be a string.');
  } else if (!VERSION_PATTERN.test(manifest.version)) {
    errors.push(
      `"version" must follow semver format (e.g. "1.0.0"). Got "${manifest.version}".`
    );
  }

  // description
  if (!manifest.description) {
    errors.push('Missing required field "description".');
  } else if (typeof manifest.description !== "string") {
    errors.push('"description" must be a string.');
  }

  // platforms
  if (!manifest.platforms) {
    errors.push('Missing required field "platforms".');
  } else if (!Array.isArray(manifest.platforms)) {
    errors.push('"platforms" must be an array.');
  } else if (manifest.platforms.length === 0) {
    errors.push('"platforms" must contain at least one platform.');
  } else {
    for (const p of manifest.platforms) {
      if (!VALID_PLATFORMS.has(p)) {
        errors.push(
          `Invalid platform "${p}". Must be one of: ${[...VALID_PLATFORMS].join(", ")}.`
        );
      }
    }
  }

  // --- Claude platform paths ---
  if (manifest.claude) {
    if (manifest.claude.skills) {
      for (const skillPath of manifest.claude.skills) {
        const fullPath = join(skillDir, skillPath);
        if (!(await pathExists(fullPath))) {
          errors.push(
            `Claude skills path does not exist: "${skillPath}" (expected at ${fullPath}).`
          );
        }
      }

      // Validate SKILL.md files inside claude skills directories
      await validateSkillMdFiles(
        manifest.claude.skills,
        skillDir,
        errors,
        warnings
      );
    }

    if (manifest.claude.agents) {
      for (const agentPath of manifest.claude.agents) {
        const fullPath = join(skillDir, agentPath);
        if (!(await pathExists(fullPath))) {
          errors.push(
            `Claude agents path does not exist: "${agentPath}" (expected at ${fullPath}).`
          );
        }
      }
    }
  }

  // --- Codex platform paths ---
  if (manifest.codex) {
    if (manifest.codex.instructions) {
      const fullPath = join(skillDir, manifest.codex.instructions);
      if (!(await pathExists(fullPath))) {
        errors.push(
          `Codex instructions file does not exist: "${manifest.codex.instructions}" (expected at ${fullPath}).`
        );
      }
    }

    if (manifest.codex.agents) {
      for (const agentPath of manifest.codex.agents) {
        const fullPath = join(skillDir, agentPath);
        if (!(await pathExists(fullPath))) {
          errors.push(
            `Codex agents path does not exist: "${agentPath}" (expected at ${fullPath}).`
          );
        }
      }
    }
  }

  // --- Warnings ---
  if (!manifest.author) {
    warnings.push('Missing optional field "author". Consider adding it.');
  }
  if (!manifest.license) {
    warnings.push('Missing optional field "license". Consider adding it.');
  }
  if (!manifest.keywords || manifest.keywords.length === 0) {
    warnings.push(
      'Missing or empty "keywords". Adding keywords improves discoverability.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Recursively finds and validates SKILL.md files within the given skill directories.
 */
async function validateSkillMdFiles(
  skillPaths: string[],
  skillDir: string,
  errors: string[],
  warnings: string[]
): Promise<void> {
  for (const skillPath of skillPaths) {
    const fullPath = join(skillDir, skillPath);
    await findAndValidateSkillMd(fullPath, skillDir, errors, warnings);
  }
}

/**
 * Recursively searches a directory for SKILL.md files and validates their frontmatter.
 */
async function findAndValidateSkillMd(
  dirPath: string,
  skillDir: string,
  errors: string[],
  warnings: string[]
): Promise<void> {
  let names: string[];
  try {
    names = readdirSync(dirPath);
  } catch {
    // Directory doesn't exist — already reported as a path error
    return;
  }

  for (const name of names) {
    const entryPath = join(dirPath, name);
    const stat = statSync(entryPath, { throwIfNoEntry: false });
    if (!stat) continue;

    if (stat.isDirectory()) {
      await findAndValidateSkillMd(entryPath, skillDir, errors, warnings);
    } else if (name === "SKILL.md") {
      await validateSingleSkillMd(entryPath, skillDir, errors, warnings);
    }
  }
}

/**
 * Validates a single SKILL.md file: checks for valid YAML frontmatter
 * with required `name` and `description` fields.
 */
async function validateSingleSkillMd(
  filePath: string,
  skillDir: string,
  errors: string[],
  _warnings: string[]
): Promise<void> {
  const relativePath = filePath.replace(skillDir + "/", "");

  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    errors.push(`Cannot read SKILL.md at "${relativePath}".`);
    return;
  }

  // Extract YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    errors.push(
      `SKILL.md at "${relativePath}" is missing YAML frontmatter (expected --- delimited block at the top).`
    );
    return;
  }

  let frontmatter: Record<string, unknown>;
  try {
    frontmatter = parseYaml(frontmatterMatch[1]) as Record<string, unknown>;
  } catch (err) {
    errors.push(
      `SKILL.md at "${relativePath}" has invalid YAML frontmatter: ${(err as Error).message}`
    );
    return;
  }

  if (!frontmatter || typeof frontmatter !== "object") {
    errors.push(
      `SKILL.md at "${relativePath}" has empty or non-object YAML frontmatter.`
    );
    return;
  }

  if (!frontmatter.name) {
    errors.push(
      `SKILL.md at "${relativePath}" is missing the "name" field in frontmatter.`
    );
  }
  if (!frontmatter.description) {
    errors.push(
      `SKILL.md at "${relativePath}" is missing the "description" field in frontmatter.`
    );
  }
}

/**
 * Checks if a path exists (file or directory).
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
