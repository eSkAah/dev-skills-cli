import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { readSkillManifest, getSkillFromMonorepo } from "../src/core/manifest.js";
import type { SkillManifest } from "../src/types.js";

describe("readSkillManifest", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "skillx-manifest-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("reads and parses a valid skillx.json", async () => {
    const manifest = {
      name: "test-skill",
      version: "1.0.0",
      description: "A test skill",
      platforms: ["claude"],
    };
    await writeFile(
      join(tempDir, "skillx.json"),
      JSON.stringify(manifest),
      "utf-8"
    );

    const result = await readSkillManifest(tempDir);
    expect(result.name).toBe("test-skill");
    expect(result.version).toBe("1.0.0");
    expect(result.description).toBe("A test skill");
    expect(result.platforms).toEqual(["claude"]);
  });

  test("throws when skillx.json is missing", async () => {
    await expect(readSkillManifest(tempDir)).rejects.toThrow(
      "Skill manifest not found"
    );
  });

  test("throws when skillx.json contains invalid JSON", async () => {
    await writeFile(
      join(tempDir, "skillx.json"),
      "{ not valid json!! }",
      "utf-8"
    );

    await expect(readSkillManifest(tempDir)).rejects.toThrow("Invalid JSON");
  });

  test("reads a monorepo manifest with skills array", async () => {
    const manifest = {
      monorepo: true,
      skills: [
        {
          name: "skill-a",
          version: "1.0.0",
          description: "Skill A",
          platforms: ["claude"],
        },
        {
          name: "skill-b",
          version: "2.0.0",
          description: "Skill B",
          platforms: ["codex"],
        },
      ],
      author: "test-author",
    };
    await writeFile(
      join(tempDir, "skillx.json"),
      JSON.stringify(manifest),
      "utf-8"
    );

    const result = await readSkillManifest(tempDir);
    expect(result.monorepo).toBe(true);
    expect(result.skills).toHaveLength(2);
    expect(result.skills![0].name).toBe("skill-a");
    expect(result.skills![1].name).toBe("skill-b");
  });
});

describe("getSkillFromMonorepo", () => {
  test("extracts a skill by name from a monorepo manifest", () => {
    const manifest: SkillManifest = {
      name: "",
      version: "",
      description: "",
      platforms: [],
      monorepo: true,
      skills: [
        {
          name: "skill-a",
          version: "1.0.0",
          description: "Skill A",
          platforms: ["claude"],
        },
        {
          name: "skill-b",
          version: "2.0.0",
          description: "Skill B",
          platforms: ["codex"],
        },
      ],
    };

    const result = getSkillFromMonorepo(manifest, "skill-b");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("skill-b");
    expect(result!.version).toBe("2.0.0");
  });

  test("returns null when skill name is not found in monorepo", () => {
    const manifest: SkillManifest = {
      name: "",
      version: "",
      description: "",
      platforms: [],
      monorepo: true,
      skills: [
        {
          name: "skill-a",
          version: "1.0.0",
          description: "Skill A",
          platforms: ["claude"],
        },
      ],
    };

    const result = getSkillFromMonorepo(manifest, "nonexistent");
    expect(result).toBeNull();
  });

  test("throws when manifest is not a monorepo", () => {
    const manifest: SkillManifest = {
      name: "single-skill",
      version: "1.0.0",
      description: "Not a monorepo",
      platforms: ["claude"],
    };

    expect(() => getSkillFromMonorepo(manifest, "anything")).toThrow(
      "not a monorepo"
    );
  });

  test("throws when monorepo skills array is empty", () => {
    const manifest: SkillManifest = {
      name: "",
      version: "",
      description: "",
      platforms: [],
      monorepo: true,
      skills: [],
    };

    expect(() => getSkillFromMonorepo(manifest, "anything")).toThrow(
      "no skills array or it is empty"
    );
  });
});
