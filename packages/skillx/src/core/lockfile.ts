import { join } from "path";
import { readFile, writeFile } from "fs/promises";
import type { Lockfile, LockfileEntry } from "../types.js";

const LOCKFILE_FILENAME = "skillx.lock";
const LOCKFILE_VERSION = 1;

/**
 * Creates a new empty lockfile structure.
 */
function createEmptyLockfile(): Lockfile {
  return {
    lockfileVersion: LOCKFILE_VERSION,
    skills: {},
  };
}

/**
 * Reads the skillx.lock file from the project root.
 * Returns an empty lockfile if the file does not exist.
 */
export async function readLockfile(projectRoot: string): Promise<Lockfile> {
  const lockfilePath = join(projectRoot, LOCKFILE_FILENAME);

  let raw: string;
  try {
    raw = await readFile(lockfilePath, "utf-8");
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return createEmptyLockfile();
    }
    throw new Error(
      `Failed to read lockfile at ${lockfilePath}: ${(err as Error).message}`
    );
  }

  let lockfile: Lockfile;
  try {
    lockfile = JSON.parse(raw) as Lockfile;
  } catch {
    throw new Error(
      `Invalid JSON in lockfile at ${lockfilePath}.\n` +
        `The lockfile may be corrupted. Delete it and reinstall your skills.`
    );
  }

  // Ensure the skills field exists
  if (!lockfile.skills) {
    lockfile.skills = {};
  }

  return lockfile;
}

/**
 * Writes the lockfile to the project root.
 */
export async function writeLockfile(
  projectRoot: string,
  lockfile: Lockfile
): Promise<void> {
  const lockfilePath = join(projectRoot, LOCKFILE_FILENAME);
  const content = JSON.stringify(lockfile, null, 2) + "\n";
  await writeFile(lockfilePath, content, "utf-8");
}

/**
 * Adds or updates a skill entry in the lockfile.
 */
export async function addLockEntry(
  projectRoot: string,
  name: string,
  entry: LockfileEntry
): Promise<void> {
  const lockfile = await readLockfile(projectRoot);
  lockfile.skills[name] = entry;
  await writeLockfile(projectRoot, lockfile);
}

/**
 * Removes a skill entry from the lockfile.
 * Throws if the entry does not exist.
 */
export async function removeLockEntry(
  projectRoot: string,
  name: string
): Promise<void> {
  const lockfile = await readLockfile(projectRoot);

  if (!(name in lockfile.skills)) {
    throw new Error(
      `Skill "${name}" is not in the lockfile. Nothing to remove.`
    );
  }

  delete lockfile.skills[name];
  await writeLockfile(projectRoot, lockfile);
}

/**
 * Retrieves a single lock entry by skill name.
 * Returns null if the skill is not in the lockfile.
 */
export async function getLockEntry(
  projectRoot: string,
  name: string
): Promise<LockfileEntry | null> {
  const lockfile = await readLockfile(projectRoot);
  return lockfile.skills[name] ?? null;
}
