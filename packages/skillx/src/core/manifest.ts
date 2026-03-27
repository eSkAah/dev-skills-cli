import { join } from "path";
import { readFile } from "fs/promises";
import type { SkillManifest } from "../types.js";

const MANIFEST_FILENAME = "skillx.json";

/**
 * Reads and parses the skillx.json manifest from an extracted skill directory.
 * Handles both single-skill and monorepo formats.
 */
export async function readSkillManifest(
  skillDir: string
): Promise<SkillManifest> {
  const manifestPath = join(skillDir, MANIFEST_FILENAME);

  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf-8");
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(
        `Skill manifest not found: ${manifestPath}\n` +
          `Make sure the repository contains a ${MANIFEST_FILENAME} at its root.`
      );
    }
    throw new Error(
      `Failed to read skill manifest at ${manifestPath}: ${(err as Error).message}`
    );
  }

  let manifest: SkillManifest;
  try {
    manifest = JSON.parse(raw) as SkillManifest;
  } catch {
    throw new Error(
      `Invalid JSON in ${manifestPath}.\n` +
        `Check for syntax errors (trailing commas, missing quotes, etc.).`
    );
  }

  return manifest;
}

/**
 * Extracts a single skill from a monorepo manifest by name.
 * Returns null if the skill is not found in the monorepo.
 */
export function getSkillFromMonorepo(
  manifest: SkillManifest,
  skillName: string
): SkillManifest | null {
  if (!manifest.monorepo) {
    throw new Error(
      `Manifest is not a monorepo. Cannot extract skill "${skillName}".`
    );
  }

  if (!manifest.skills || manifest.skills.length === 0) {
    throw new Error(
      `Monorepo manifest has no skills array or it is empty.`
    );
  }

  const skill = manifest.skills.find((s) => s.name === skillName);
  return skill ?? null;
}
