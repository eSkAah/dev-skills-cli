import { describe, test, expect } from "bun:test";
import { parseSpecifier } from "../src/core/resolver.js";

describe("parseSpecifier", () => {
  test("user/repo returns owner and repo", () => {
    const result = parseSpecifier("user/repo");
    expect(result).toEqual({ owner: "user", repo: "repo" });
  });

  test("user/repo@v1.0.0 extracts tag ref", () => {
    const result = parseSpecifier("user/repo@v1.0.0");
    expect(result).toEqual({ owner: "user", repo: "repo", ref: "v1.0.0" });
  });

  test("user/repo@abc1234 extracts commit SHA ref", () => {
    const result = parseSpecifier("user/repo@abc1234");
    expect(result).toEqual({ owner: "user", repo: "repo", ref: "abc1234" });
  });

  test("user/repo#main extracts branch ref", () => {
    const result = parseSpecifier("user/repo#main");
    expect(result).toEqual({ owner: "user", repo: "repo", ref: "main" });
  });

  test("github:user/repo strips prefix", () => {
    const result = parseSpecifier("github:user/repo");
    expect(result).toEqual({ owner: "user", repo: "repo" });
  });

  test("github:user/repo@v2.0.0 strips prefix and extracts ref", () => {
    const result = parseSpecifier("github:user/repo@v2.0.0");
    expect(result).toEqual({ owner: "user", repo: "repo", ref: "v2.0.0" });
  });

  test("user/repo:skill-name extracts skillName", () => {
    const result = parseSpecifier("user/repo:skill-name");
    expect(result).toEqual({
      owner: "user",
      repo: "repo",
      skillName: "skill-name",
    });
  });

  test("user/repo@v1.0.0:skill extracts ref and skillName", () => {
    const result = parseSpecifier("user/repo@v1.0.0:skill");
    expect(result).toEqual({
      owner: "user",
      repo: "repo",
      ref: "v1.0.0",
      skillName: "skill",
    });
  });

  test("user/repo#develop:my-skill extracts branch ref and skillName", () => {
    const result = parseSpecifier("user/repo#develop:my-skill");
    expect(result).toEqual({
      owner: "user",
      repo: "repo",
      ref: "develop",
      skillName: "my-skill",
    });
  });

  test("trims whitespace around input", () => {
    const result = parseSpecifier("  user/repo  ");
    expect(result).toEqual({ owner: "user", repo: "repo" });
  });

  // Invalid inputs
  test("throws for empty string", () => {
    expect(() => parseSpecifier("")).toThrow("Invalid skill specifier");
  });

  test("throws for string without slash", () => {
    expect(() => parseSpecifier("noslash")).toThrow("Invalid skill specifier");
  });

  test("throws for missing owner (starts with /)", () => {
    expect(() => parseSpecifier("/repo")).toThrow("Missing owner");
  });

  test("throws for missing repo (trailing slash)", () => {
    expect(() => parseSpecifier("user/")).toThrow("Missing repository name");
  });

  test("throws for empty ref after @", () => {
    expect(() => parseSpecifier("user/repo@")).toThrow("Empty ref");
  });

  test("throws for empty ref after #", () => {
    expect(() => parseSpecifier("user/repo#")).toThrow("Empty ref");
  });

  test("throws for empty skill name after :", () => {
    expect(() => parseSpecifier("user/repo:")).toThrow("Empty skill name");
  });
});
