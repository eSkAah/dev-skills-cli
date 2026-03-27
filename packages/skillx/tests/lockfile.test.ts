import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  readLockfile,
  addLockEntry,
  getLockEntry,
  removeLockEntry,
} from "../src/core/lockfile.js";
import type { LockfileEntry } from "../src/types.js";

describe("lockfile operations", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "skillx-lockfile-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function makeLockEntry(overrides?: Partial<LockfileEntry>): LockfileEntry {
    return {
      source: "github:user/repo",
      version: "1.0.0",
      resolved: "https://api.github.com/repos/user/repo/tarball/v1.0.0",
      sha: "abc1234567890",
      installedAt: "2026-03-27T10:00:00Z",
      files: {
        claude: [".claude/skills/test-skill/SKILL.md"],
        codex: [],
      },
      ...overrides,
    };
  }

  test("readLockfile returns empty lockfile when file does not exist", async () => {
    const lockfile = await readLockfile(tempDir);
    expect(lockfile.lockfileVersion).toBe(1);
    expect(lockfile.skills).toEqual({});
  });

  test("addLockEntry + getLockEntry roundtrip", async () => {
    const entry = makeLockEntry();
    await addLockEntry(tempDir, "test-skill", entry);

    const retrieved = await getLockEntry(tempDir, "test-skill");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.source).toBe("github:user/repo");
    expect(retrieved!.version).toBe("1.0.0");
    expect(retrieved!.sha).toBe("abc1234567890");
    expect(retrieved!.files.claude).toEqual([
      ".claude/skills/test-skill/SKILL.md",
    ]);
  });

  test("addLockEntry updates existing entry", async () => {
    const entry1 = makeLockEntry({ version: "1.0.0" });
    await addLockEntry(tempDir, "test-skill", entry1);

    const entry2 = makeLockEntry({ version: "2.0.0", sha: "def9876543210" });
    await addLockEntry(tempDir, "test-skill", entry2);

    const retrieved = await getLockEntry(tempDir, "test-skill");
    expect(retrieved!.version).toBe("2.0.0");
    expect(retrieved!.sha).toBe("def9876543210");
  });

  test("removeLockEntry removes the entry", async () => {
    const entry = makeLockEntry();
    await addLockEntry(tempDir, "test-skill", entry);

    await removeLockEntry(tempDir, "test-skill");

    const retrieved = await getLockEntry(tempDir, "test-skill");
    expect(retrieved).toBeNull();
  });

  test("removeLockEntry throws for non-existent entry", async () => {
    await expect(
      removeLockEntry(tempDir, "nonexistent")
    ).rejects.toThrow('Skill "nonexistent" is not in the lockfile');
  });

  test("getLockEntry returns null for non-existent skill", async () => {
    const entry = makeLockEntry();
    await addLockEntry(tempDir, "test-skill", entry);

    const retrieved = await getLockEntry(tempDir, "other-skill");
    expect(retrieved).toBeNull();
  });

  test("multiple entries coexist in the lockfile", async () => {
    const entry1 = makeLockEntry({ source: "github:user/repo-a" });
    const entry2 = makeLockEntry({ source: "github:user/repo-b" });

    await addLockEntry(tempDir, "skill-a", entry1);
    await addLockEntry(tempDir, "skill-b", entry2);

    const lockfile = await readLockfile(tempDir);
    expect(Object.keys(lockfile.skills)).toHaveLength(2);

    const a = await getLockEntry(tempDir, "skill-a");
    const b = await getLockEntry(tempDir, "skill-b");
    expect(a!.source).toBe("github:user/repo-a");
    expect(b!.source).toBe("github:user/repo-b");
  });
});
