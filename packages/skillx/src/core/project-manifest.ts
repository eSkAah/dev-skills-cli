import { join } from "path";
import { readFile, writeFile } from "fs/promises";
import type { PlatformName, ProjectManifest } from "../types.js";

const MANIFEST_FILENAME = "skillx.json";

/**
 * Reads the project-level skillx.json from the project root.
 * Returns an empty manifest (with no skills) if the file does not exist.
 */
export async function readProjectManifest(
  projectRoot: string
): Promise<ProjectManifest> {
  const manifestPath = join(projectRoot, MANIFEST_FILENAME);

  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf-8");
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { skills: {} };
    }
    throw new Error(
      `Failed to read project manifest at ${manifestPath}: ${(err as Error).message}`
    );
  }

  let manifest: ProjectManifest;
  try {
    manifest = JSON.parse(raw) as ProjectManifest;
  } catch {
    throw new Error(
      `Invalid JSON in project manifest at ${manifestPath}.\n` +
        `Check for syntax errors (trailing commas, missing quotes, etc.).`
    );
  }

  // Ensure the skills field exists
  if (!manifest.skills) {
    manifest.skills = {};
  }

  return manifest;
}

/**
 * Writes the project-level skillx.json to the project root.
 */
export async function writeProjectManifest(
  projectRoot: string,
  manifest: ProjectManifest
): Promise<void> {
  const manifestPath = join(projectRoot, MANIFEST_FILENAME);
  const content = JSON.stringify(manifest, null, 2) + "\n";
  await writeFile(manifestPath, content, "utf-8");
}

/**
 * Adds a skill entry to the project manifest.
 * If the skill already exists, it will be updated.
 */
export async function addSkill(
  projectRoot: string,
  entry: {
    name: string;
    source: string;
    version: string;
    platforms: PlatformName[];
  }
): Promise<void> {
  const manifest = await readProjectManifest(projectRoot);

  manifest.skills[entry.name] = {
    source: entry.source,
    version: entry.version,
    platforms: entry.platforms,
  };

  await writeProjectManifest(projectRoot, manifest);
}

/**
 * Removes a skill entry from the project manifest.
 * Throws if the skill is not found.
 */
export async function removeSkill(
  projectRoot: string,
  skillName: string
): Promise<void> {
  const manifest = await readProjectManifest(projectRoot);

  if (!(skillName in manifest.skills)) {
    throw new Error(
      `Skill "${skillName}" is not listed in the project manifest.`
    );
  }

  delete manifest.skills[skillName];

  await writeProjectManifest(projectRoot, manifest);
}
