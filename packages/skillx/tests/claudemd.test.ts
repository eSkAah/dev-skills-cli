import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { injectClaudeMd, removeClaudeMd } from "../src/core/claudemd.js";

describe("claudemd operations", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "skillx-claudemd-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function readClaudeMd(): Promise<string> {
    return readFile(join(tempDir, "CLAUDE.md"), "utf-8");
  }

  async function writeClaudeMd(content: string): Promise<void> {
    await writeFile(join(tempDir, "CLAUDE.md"), content, "utf-8");
  }

  // --- injectClaudeMd ---

  describe("injectClaudeMd", () => {
    test("creates CLAUDE.md if it doesn't exist", async () => {
      const result = await injectClaudeMd(tempDir, "my-skill", [
        { section: "## Commands", content: "- `npm test` -- Run tests" },
      ]);

      expect(result).toEqual(["CLAUDE.md"]);

      const content = await readClaudeMd();
      expect(content).toContain("# CLAUDE.md");
      expect(content).toContain("## Commands");
      expect(content).toContain("<!-- skillx:my-skill:start -->");
      expect(content).toContain("- `npm test` -- Run tests");
      expect(content).toContain("<!-- skillx:my-skill:end -->");
    });

    test("returns empty array when no entries provided", async () => {
      const result = await injectClaudeMd(tempDir, "my-skill", []);
      expect(result).toEqual([]);
    });

    test("appends to existing section", async () => {
      await writeClaudeMd(
        "# CLAUDE.md\n\n## Commands\n\n- `npm run dev` -- Start dev server\n",
      );

      await injectClaudeMd(tempDir, "my-skill", [
        { section: "## Commands", content: "- `npm test` -- Run tests" },
      ]);

      const content = await readClaudeMd();
      expect(content).toContain("- `npm run dev` -- Start dev server");
      expect(content).toContain("<!-- skillx:my-skill:start -->");
      expect(content).toContain("- `npm test` -- Run tests");
      expect(content).toContain("<!-- skillx:my-skill:end -->");
    });

    test("creates new section when section doesn't exist", async () => {
      await writeClaudeMd(
        "# CLAUDE.md\n\n## Commands\n\n- `npm run dev` -- Start dev server\n",
      );

      await injectClaudeMd(tempDir, "my-skill", [
        {
          section: "## Architecture",
          content: "This project uses Blazor .NET 8.",
        },
      ]);

      const content = await readClaudeMd();
      // Original content preserved
      expect(content).toContain("## Commands");
      expect(content).toContain("- `npm run dev` -- Start dev server");
      // New section added
      expect(content).toContain("## Architecture");
      expect(content).toContain("<!-- skillx:my-skill:start -->");
      expect(content).toContain("This project uses Blazor .NET 8.");
      expect(content).toContain("<!-- skillx:my-skill:end -->");
    });

    test("multiple entries inject into different sections", async () => {
      await writeClaudeMd(
        "# CLAUDE.md\n\n## Commands\n\n- `npm run dev` -- Start dev\n\n## Architecture\n\nExisting architecture notes.\n",
      );

      await injectClaudeMd(tempDir, "my-skill", [
        { section: "## Commands", content: "- `dotnet build` -- Build" },
        { section: "## Architecture", content: "Uses Blazor .NET 8." },
      ]);

      const content = await readClaudeMd();
      // Both entries injected
      expect(content).toContain("- `dotnet build` -- Build");
      expect(content).toContain("Uses Blazor .NET 8.");
      // Both have markers
      const startCount = content.split("<!-- skillx:my-skill:start -->").length - 1;
      const endCount = content.split("<!-- skillx:my-skill:end -->").length - 1;
      expect(startCount).toBe(2);
      expect(endCount).toBe(2);
    });

    test("is idempotent — running twice replaces existing markers", async () => {
      await writeClaudeMd(
        "# CLAUDE.md\n\n## Commands\n\n- `npm run dev` -- Start dev\n",
      );

      // First inject
      await injectClaudeMd(tempDir, "my-skill", [
        { section: "## Commands", content: "- `dotnet build` -- Build" },
      ]);

      // Second inject with different content
      await injectClaudeMd(tempDir, "my-skill", [
        { section: "## Commands", content: "- `dotnet test` -- Test" },
      ]);

      const content = await readClaudeMd();
      // Old content removed
      expect(content).not.toContain("- `dotnet build` -- Build");
      // New content present
      expect(content).toContain("- `dotnet test` -- Test");
      // Only one pair of markers
      const startCount = content.split("<!-- skillx:my-skill:start -->").length - 1;
      expect(startCount).toBe(1);
    });

    test("multiple skills can inject into the same section", async () => {
      await writeClaudeMd(
        "# CLAUDE.md\n\n## Commands\n\n- `npm run dev` -- Start dev\n",
      );

      await injectClaudeMd(tempDir, "skill-a", [
        { section: "## Commands", content: "- `cmd-a` -- from skill A" },
      ]);

      await injectClaudeMd(tempDir, "skill-b", [
        { section: "## Commands", content: "- `cmd-b` -- from skill B" },
      ]);

      const content = await readClaudeMd();
      expect(content).toContain("<!-- skillx:skill-a:start -->");
      expect(content).toContain("- `cmd-a` -- from skill A");
      expect(content).toContain("<!-- skillx:skill-a:end -->");
      expect(content).toContain("<!-- skillx:skill-b:start -->");
      expect(content).toContain("- `cmd-b` -- from skill B");
      expect(content).toContain("<!-- skillx:skill-b:end -->");
      // Original content preserved
      expect(content).toContain("- `npm run dev` -- Start dev");
    });

    test("preserves content outside of skillx markers", async () => {
      const original =
        "# CLAUDE.md\n\nSome custom content here.\n\n## Commands\n\n- `npm run dev` -- Start dev\n\nMore custom content.\n";
      await writeClaudeMd(original);

      await injectClaudeMd(tempDir, "my-skill", [
        { section: "## Commands", content: "- `dotnet build` -- Build" },
      ]);

      const content = await readClaudeMd();
      expect(content).toContain("Some custom content here.");
      expect(content).toContain("- `npm run dev` -- Start dev");
      expect(content).toContain("More custom content.");
    });

    test("appends content at end of section before next section", async () => {
      await writeClaudeMd(
        "# CLAUDE.md\n\n## Commands\n\n- `npm run dev` -- Start dev\n\n## Architecture\n\nArch notes.\n",
      );

      await injectClaudeMd(tempDir, "my-skill", [
        { section: "## Commands", content: "- `dotnet build` -- Build" },
      ]);

      const content = await readClaudeMd();
      // The injected block should be between Commands content and Architecture heading
      const commandsIdx = content.indexOf("- `npm run dev`");
      const injectedIdx = content.indexOf("<!-- skillx:my-skill:start -->");
      const archIdx = content.indexOf("## Architecture");

      expect(commandsIdx).toBeLessThan(injectedIdx);
      expect(injectedIdx).toBeLessThan(archIdx);
    });
  });

  // --- removeClaudeMd ---

  describe("removeClaudeMd", () => {
    test("returns empty array when CLAUDE.md doesn't exist", async () => {
      const result = await removeClaudeMd(tempDir, "my-skill");
      expect(result).toEqual([]);
    });

    test("returns empty array when no markers found", async () => {
      await writeClaudeMd("# CLAUDE.md\n\n## Commands\n\n- `npm run dev`\n");

      const result = await removeClaudeMd(tempDir, "my-skill");
      expect(result).toEqual([]);
    });

    test("removes injected block", async () => {
      await writeClaudeMd(
        "# CLAUDE.md\n\n## Commands\n\n- `npm run dev` -- Start dev\n\n<!-- skillx:my-skill:start -->\n- `dotnet build` -- Build\n<!-- skillx:my-skill:end -->\n",
      );

      const result = await removeClaudeMd(tempDir, "my-skill");
      expect(result).toEqual(["CLAUDE.md"]);

      const content = await readClaudeMd();
      expect(content).not.toContain("<!-- skillx:my-skill:start -->");
      expect(content).not.toContain("- `dotnet build` -- Build");
      expect(content).not.toContain("<!-- skillx:my-skill:end -->");
      // Preserved content
      expect(content).toContain("- `npm run dev` -- Start dev");
    });

    test("removes empty section after block removal", async () => {
      // Section has only the skillx block, no other content
      await writeClaudeMd(
        "# CLAUDE.md\n\n## Commands\n\n- `npm run dev`\n\n## Architecture\n\n<!-- skillx:my-skill:start -->\nBlazor notes.\n<!-- skillx:my-skill:end -->\n",
      );

      await removeClaudeMd(tempDir, "my-skill");

      const content = await readClaudeMd();
      // Architecture section should be removed since it had no other content
      expect(content).not.toContain("## Architecture");
      // Commands section preserved
      expect(content).toContain("## Commands");
      expect(content).toContain("- `npm run dev`");
    });

    test("keeps section if it still has content after block removal", async () => {
      await writeClaudeMd(
        "# CLAUDE.md\n\n## Architecture\n\nExisting arch notes.\n\n<!-- skillx:my-skill:start -->\nBlazor notes.\n<!-- skillx:my-skill:end -->\n",
      );

      await removeClaudeMd(tempDir, "my-skill");

      const content = await readClaudeMd();
      expect(content).toContain("## Architecture");
      expect(content).toContain("Existing arch notes.");
      expect(content).not.toContain("Blazor notes.");
    });

    test("removes only the target skill's blocks, not others", async () => {
      await writeClaudeMd(
        "# CLAUDE.md\n\n## Commands\n\n<!-- skillx:skill-a:start -->\n- `cmd-a`\n<!-- skillx:skill-a:end -->\n\n<!-- skillx:skill-b:start -->\n- `cmd-b`\n<!-- skillx:skill-b:end -->\n",
      );

      await removeClaudeMd(tempDir, "skill-a");

      const content = await readClaudeMd();
      expect(content).not.toContain("skill-a");
      expect(content).not.toContain("- `cmd-a`");
      expect(content).toContain("<!-- skillx:skill-b:start -->");
      expect(content).toContain("- `cmd-b`");
      expect(content).toContain("<!-- skillx:skill-b:end -->");
    });

    test("does not delete CLAUDE.md even when all content is removed", async () => {
      await writeClaudeMd(
        "# CLAUDE.md\n\n## Commands\n\n<!-- skillx:my-skill:start -->\n- `cmd`\n<!-- skillx:my-skill:end -->\n",
      );

      await removeClaudeMd(tempDir, "my-skill");

      // File should still exist
      const content = await readClaudeMd();
      expect(content).toBeTruthy();
      expect(content).toContain("# CLAUDE.md");
    });

    test("handles multiple blocks for the same skill across sections", async () => {
      await writeClaudeMd(
        [
          "# CLAUDE.md",
          "",
          "## Commands",
          "",
          "<!-- skillx:my-skill:start -->",
          "- `dotnet build`",
          "<!-- skillx:my-skill:end -->",
          "",
          "## Architecture",
          "",
          "<!-- skillx:my-skill:start -->",
          "Blazor notes.",
          "<!-- skillx:my-skill:end -->",
          "",
        ].join("\n"),
      );

      const result = await removeClaudeMd(tempDir, "my-skill");
      expect(result).toEqual(["CLAUDE.md"]);

      const content = await readClaudeMd();
      expect(content).not.toContain("skillx:my-skill");
      expect(content).not.toContain("- `dotnet build`");
      expect(content).not.toContain("Blazor notes.");
    });

    test("cleans up excessive blank lines after removal", async () => {
      await writeClaudeMd(
        "# CLAUDE.md\n\n## Commands\n\n- `npm run dev`\n\n\n<!-- skillx:my-skill:start -->\n- `cmd`\n<!-- skillx:my-skill:end -->\n\n\nMore content.\n",
      );

      await removeClaudeMd(tempDir, "my-skill");

      const content = await readClaudeMd();
      // No triple-newline sequences
      expect(content).not.toContain("\n\n\n");
    });
  });

  // --- Integration: inject then remove ---

  describe("inject + remove roundtrip", () => {
    test("inject then remove restores original structure", async () => {
      const original =
        "# CLAUDE.md\n\n## Commands\n\n- `npm run dev` -- Start dev\n\n## Architecture\n\nExisting notes.\n";
      await writeClaudeMd(original);

      // Inject
      await injectClaudeMd(tempDir, "my-skill", [
        { section: "## Commands", content: "- `dotnet build` -- Build" },
        { section: "## Architecture", content: "Blazor notes." },
      ]);

      // Verify injection worked
      let content = await readClaudeMd();
      expect(content).toContain("<!-- skillx:my-skill:start -->");

      // Remove
      await removeClaudeMd(tempDir, "my-skill");

      content = await readClaudeMd();
      expect(content).not.toContain("skillx:my-skill");
      expect(content).toContain("- `npm run dev` -- Start dev");
      expect(content).toContain("Existing notes.");
    });

    test("inject into new section, then remove deletes the section entirely", async () => {
      await writeClaudeMd("# CLAUDE.md\n\n## Commands\n\n- `npm run dev`\n");

      // Inject into a section that doesn't exist
      await injectClaudeMd(tempDir, "my-skill", [
        { section: "## New Section", content: "New content here." },
      ]);

      let content = await readClaudeMd();
      expect(content).toContain("## New Section");

      // Remove should clean up the empty section
      await removeClaudeMd(tempDir, "my-skill");

      content = await readClaudeMd();
      expect(content).not.toContain("## New Section");
      expect(content).toContain("## Commands");
    });
  });
});
