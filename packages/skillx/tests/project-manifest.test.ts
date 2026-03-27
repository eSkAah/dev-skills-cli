import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  readProjectManifest,
  addSkill,
  removeSkill,
} from "../src/core/project-manifest.js";

describe("project manifest operations", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "skillx-projmanifest-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("readProjectManifest returns empty manifest when file does not exist", async () => {
    const manifest = await readProjectManifest(tempDir);
    expect(manifest.skills).toEqual({});
  });

  test("addSkill + readProjectManifest roundtrip", async () => {
    await addSkill(tempDir, {
      name: "test-skill",
      source: "github:user/repo",
      version: "1.0.0",
      platforms: ["claude"],
    });

    const manifest = await readProjectManifest(tempDir);
    expect(manifest.skills["test-skill"]).toBeDefined();
    expect(manifest.skills["test-skill"].source).toBe("github:user/repo");
    expect(manifest.skills["test-skill"].version).toBe("1.0.0");
    expect(manifest.skills["test-skill"].platforms).toEqual(["claude"]);
  });

  test("addSkill updates existing skill entry", async () => {
    await addSkill(tempDir, {
      name: "test-skill",
      source: "github:user/repo",
      version: "1.0.0",
      platforms: ["claude"],
    });

    await addSkill(tempDir, {
      name: "test-skill",
      source: "github:user/repo",
      version: "2.0.0",
      platforms: ["claude", "codex"],
    });

    const manifest = await readProjectManifest(tempDir);
    expect(manifest.skills["test-skill"].version).toBe("2.0.0");
    expect(manifest.skills["test-skill"].platforms).toEqual(["claude", "codex"]);
  });

  test("removeSkill removes the skill", async () => {
    await addSkill(tempDir, {
      name: "test-skill",
      source: "github:user/repo",
      version: "1.0.0",
      platforms: ["claude"],
    });

    await removeSkill(tempDir, "test-skill");

    const manifest = await readProjectManifest(tempDir);
    expect(manifest.skills["test-skill"]).toBeUndefined();
  });

  test("removeSkill throws for non-existent skill", async () => {
    await expect(
      removeSkill(tempDir, "nonexistent")
    ).rejects.toThrow('Skill "nonexistent" is not listed in the project manifest');
  });

  test("multiple skills coexist in the project manifest", async () => {
    await addSkill(tempDir, {
      name: "skill-a",
      source: "github:user/repo-a",
      version: "1.0.0",
      platforms: ["claude"],
    });

    await addSkill(tempDir, {
      name: "skill-b",
      source: "github:user/repo-b",
      version: "2.0.0",
      platforms: ["codex"],
    });

    const manifest = await readProjectManifest(tempDir);
    expect(Object.keys(manifest.skills)).toHaveLength(2);
    expect(manifest.skills["skill-a"].source).toBe("github:user/repo-a");
    expect(manifest.skills["skill-b"].source).toBe("github:user/repo-b");
  });

  test("removeSkill preserves other skills", async () => {
    await addSkill(tempDir, {
      name: "skill-a",
      source: "github:user/repo-a",
      version: "1.0.0",
      platforms: ["claude"],
    });

    await addSkill(tempDir, {
      name: "skill-b",
      source: "github:user/repo-b",
      version: "2.0.0",
      platforms: ["codex"],
    });

    await removeSkill(tempDir, "skill-a");

    const manifest = await readProjectManifest(tempDir);
    expect(manifest.skills["skill-a"]).toBeUndefined();
    expect(manifest.skills["skill-b"]).toBeDefined();
    expect(manifest.skills["skill-b"].source).toBe("github:user/repo-b");
  });
});
