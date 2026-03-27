import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { validateSkillManifest } from "../src/core/validator.js";
import type { SkillManifest } from "../src/types.js";

describe("validateSkillManifest", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "skillx-validator-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function validManifest(overrides?: Partial<SkillManifest>): SkillManifest {
    return {
      name: "valid-skill",
      version: "1.0.0",
      description: "A valid skill for testing",
      platforms: ["claude"],
      author: "test-author",
      license: "MIT",
      keywords: ["test"],
      ...overrides,
    } as SkillManifest;
  }

  test("valid manifest returns { valid: true }", async () => {
    const result = await validateSkillManifest(validManifest(), tempDir);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("missing name produces an error", async () => {
    const manifest = validManifest({ name: "" });
    const result = await validateSkillManifest(manifest, tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"name"'))).toBe(true);
  });

  test("invalid name format (uppercase) produces an error", async () => {
    const manifest = validManifest({ name: "InvalidName" });
    const result = await validateSkillManifest(manifest, tempDir);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("lowercase"))
    ).toBe(true);
  });

  test("invalid name format (spaces) produces an error", async () => {
    const manifest = validManifest({ name: "has spaces" });
    const result = await validateSkillManifest(manifest, tempDir);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("lowercase"))
    ).toBe(true);
  });

  test("name starting with a digit produces an error", async () => {
    const manifest = validManifest({ name: "1invalid" });
    const result = await validateSkillManifest(manifest, tempDir);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("lowercase letter"))
    ).toBe(true);
  });

  test("missing platforms produces an error", async () => {
    const manifest = validManifest();
    // @ts-expect-error - testing invalid input
    delete manifest.platforms;
    const result = await validateSkillManifest(manifest, tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"platforms"'))).toBe(true);
  });

  test("empty platforms array produces an error", async () => {
    const manifest = validManifest({ platforms: [] });
    const result = await validateSkillManifest(manifest, tempDir);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("at least one platform"))
    ).toBe(true);
  });

  test("invalid platform value produces an error", async () => {
    const manifest = validManifest({
      platforms: ["invalid" as any],
    });
    const result = await validateSkillManifest(manifest, tempDir);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('Invalid platform "invalid"'))
    ).toBe(true);
  });

  test("name too long (>64 chars) produces an error", async () => {
    const longName = "a" + "-long".repeat(20); // 101 chars
    const manifest = validManifest({ name: longName });
    const result = await validateSkillManifest(manifest, tempDir);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("at most 64 characters"))
    ).toBe(true);
  });

  test("missing version produces an error", async () => {
    const manifest = validManifest({ version: "" });
    const result = await validateSkillManifest(manifest, tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"version"'))).toBe(true);
  });

  test("invalid version format produces an error", async () => {
    const manifest = validManifest({ version: "not-semver" });
    const result = await validateSkillManifest(manifest, tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("semver"))).toBe(true);
  });

  test("missing description produces an error", async () => {
    const manifest = validManifest({ description: "" });
    const result = await validateSkillManifest(manifest, tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"description"'))).toBe(true);
  });

  test("warnings for missing optional fields", async () => {
    const manifest = validManifest();
    delete manifest.author;
    delete manifest.license;
    delete manifest.keywords;
    const result = await validateSkillManifest(manifest, tempDir);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
    expect(result.warnings.some((w) => w.includes("author"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("license"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("keywords"))).toBe(true);
  });

  test("claude skills path that does not exist produces an error", async () => {
    const manifest = validManifest({
      claude: { skills: ["nonexistent/path/"] },
    });
    const result = await validateSkillManifest(manifest, tempDir);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("does not exist"))
    ).toBe(true);
  });

  test("claude skills path that exists passes validation", async () => {
    const skillsDir = join(tempDir, "claude", "skills");
    await mkdir(skillsDir, { recursive: true });
    const manifest = validManifest({
      claude: { skills: ["claude/skills/"] },
    });
    const result = await validateSkillManifest(manifest, tempDir);
    // Should not have path-related errors (may have SKILL.md warnings)
    expect(
      result.errors.some((e) => e.includes("does not exist"))
    ).toBe(false);
  });
});
