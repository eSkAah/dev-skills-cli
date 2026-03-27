import { describe, test, expect } from "bun:test";
import { parseArgs } from "../src/utils/args.js";

describe("parseArgs", () => {
  describe("command extraction", () => {
    test("extracts command as first positional argument", () => {
      const result = parseArgs(["install", "user/repo"]);
      expect(result.command).toBe("install");
    });

    test("returns null command when no arguments", () => {
      const result = parseArgs([]);
      expect(result.command).toBeNull();
    });

    test("extracts remaining positionals after command", () => {
      const result = parseArgs(["install", "user/repo", "user/repo2"]);
      expect(result.command).toBe("install");
      expect(result.positionals).toEqual(["user/repo", "user/repo2"]);
    });
  });

  describe("alias mapping", () => {
    test("i maps to install", () => {
      const result = parseArgs(["i", "user/repo"]);
      expect(result.command).toBe("install");
    });

    test("un maps to uninstall", () => {
      const result = parseArgs(["un", "my-skill"]);
      expect(result.command).toBe("uninstall");
    });

    test("ls maps to list", () => {
      const result = parseArgs(["ls"]);
      expect(result.command).toBe("list");
    });

    test("unknown command passes through unchanged", () => {
      const result = parseArgs(["auth"]);
      expect(result.command).toBe("auth");
    });
  });

  describe("flag parsing", () => {
    test("--verbose sets verbose flag", () => {
      const result = parseArgs(["list", "--verbose"]);
      expect(result.flags.verbose).toBe(true);
    });

    test("--quiet sets quiet flag", () => {
      const result = parseArgs(["install", "user/repo", "--quiet"]);
      expect(result.flags.quiet).toBe(true);
    });

    test("--force sets force flag", () => {
      const result = parseArgs(["install", "user/repo", "--force"]);
      expect(result.flags.force).toBe(true);
    });

    test("--help sets help flag", () => {
      const result = parseArgs(["--help"]);
      expect(result.flags.help).toBe(true);
    });

    test("-h sets help flag", () => {
      const result = parseArgs(["-h"]);
      expect(result.flags.help).toBe(true);
    });

    test("--version sets version flag", () => {
      const result = parseArgs(["--version"]);
      expect(result.flags.version).toBe(true);
    });

    test("-v sets version flag", () => {
      const result = parseArgs(["-v"]);
      expect(result.flags.version).toBe(true);
    });

    test("--platform claude sets platform to claude", () => {
      const result = parseArgs(["install", "user/repo", "--platform", "claude"]);
      expect(result.flags.platform).toBe("claude");
    });

    test("--platform codex sets platform to codex", () => {
      const result = parseArgs(["install", "user/repo", "--platform", "codex"]);
      expect(result.flags.platform).toBe("codex");
    });

    test("--platform all sets platform to all", () => {
      const result = parseArgs(["install", "user/repo", "--platform", "all"]);
      expect(result.flags.platform).toBe("all");
    });

    test("platform defaults to null when not specified", () => {
      const result = parseArgs(["install", "user/repo"]);
      expect(result.flags.platform).toBeNull();
    });

    test("flags default to false", () => {
      const result = parseArgs(["install", "user/repo"]);
      expect(result.flags.verbose).toBe(false);
      expect(result.flags.quiet).toBe(false);
      expect(result.flags.force).toBe(false);
      expect(result.flags.help).toBe(false);
      expect(result.flags.version).toBe(false);
    });
  });

  describe("positional args extraction", () => {
    test("positional args exclude the command", () => {
      const result = parseArgs(["install", "user/repo"]);
      expect(result.positionals).toEqual(["user/repo"]);
    });

    test("flags are not included in positionals", () => {
      const result = parseArgs([
        "install",
        "user/repo",
        "--verbose",
        "--force",
      ]);
      expect(result.positionals).toEqual(["user/repo"]);
    });

    test("empty positionals when only command is provided", () => {
      const result = parseArgs(["list"]);
      expect(result.positionals).toEqual([]);
    });

    test("mixed flags and positionals are parsed correctly", () => {
      const result = parseArgs([
        "install",
        "--verbose",
        "user/repo",
        "--platform",
        "claude",
        "--force",
      ]);
      expect(result.command).toBe("install");
      expect(result.positionals).toEqual(["user/repo"]);
      expect(result.flags.verbose).toBe(true);
      expect(result.flags.platform).toBe("claude");
      expect(result.flags.force).toBe(true);
    });
  });
});
