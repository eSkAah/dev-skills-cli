import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const CLAUDE_MD = "CLAUDE.md";
const DEFAULT_HEADER = "# CLAUDE.md\n";

/**
 * Build the start marker for a skill's injected block.
 */
function startMarker(skillName: string): string {
  return `<!-- skillx:${skillName}:start -->`;
}

/**
 * Build the end marker for a skill's injected block.
 */
function endMarker(skillName: string): string {
  return `<!-- skillx:${skillName}:end -->`;
}

/**
 * Read CLAUDE.md from the project root.
 * If the file does not exist, return null.
 */
async function readClaudeMd(projectRoot: string): Promise<string | null> {
  const filePath = join(projectRoot, CLAUDE_MD);
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Write content to CLAUDE.md at the project root.
 */
async function writeClaudeMd(
  projectRoot: string,
  content: string,
): Promise<void> {
  const filePath = join(projectRoot, CLAUDE_MD);
  await writeFile(filePath, content, "utf-8");
}

/**
 * Find the end of a section (the position right before the next `## ` heading or EOF).
 *
 * @param content - Full file content
 * @param sectionHeading - The section heading to find (e.g. "## Commands")
 * @returns Object with `start` (index of heading), `contentStart` (index after heading line),
 *          and `end` (index where section content ends, before next heading or EOF).
 *          Returns null if section not found.
 */
function findSection(
  content: string,
  sectionHeading: string,
): { start: number; contentStart: number; end: number } | null {
  // Find the section heading — must be at start of a line
  const headingPattern = new RegExp(
    `^${escapeRegExp(sectionHeading)}\\s*$`,
    "m",
  );
  const match = headingPattern.exec(content);

  if (!match) {
    return null;
  }

  const start = match.index;
  const contentStart = start + match[0].length + 1; // +1 for newline

  // Find the next section heading (## ) after the matched one
  const afterHeading = content.slice(contentStart);
  const nextHeadingMatch = /^## /m.exec(afterHeading);

  let end: number;
  if (nextHeadingMatch) {
    end = contentStart + nextHeadingMatch.index;
  } else {
    end = content.length;
  }

  return { start, contentStart, end };
}

/**
 * Remove an existing skillx block for a given skill name from the content.
 * Returns the content with the block removed, and whether a block was found.
 */
function removeSkillBlock(
  content: string,
  skillName: string,
): { content: string; found: boolean } {
  const start = startMarker(skillName);
  const end = endMarker(skillName);

  const startIdx = content.indexOf(start);
  if (startIdx === -1) {
    return { content, found: false };
  }

  const endIdx = content.indexOf(end, startIdx);
  if (endIdx === -1) {
    return { content, found: false };
  }

  const endOfEndMarker = endIdx + end.length;

  // Remove the block including surrounding blank lines
  let removeStart = startIdx;
  let removeEnd = endOfEndMarker;

  // Consume the newline after the end marker
  if (content[removeEnd] === "\n") {
    removeEnd++;
  }

  // Consume a blank line before the start marker (if any)
  if (removeStart > 0 && content[removeStart - 1] === "\n") {
    // Check if there is another newline before that (blank line)
    if (removeStart > 1 && content[removeStart - 2] === "\n") {
      removeStart--;
    }
  }

  const result = content.slice(0, removeStart) + content.slice(removeEnd);

  return { content: result, found: true };
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Inject content into CLAUDE.md for a skill.
 *
 * For each entry:
 * 1. If the target section exists, append the content at the end of that section
 *    wrapped in skillx markers.
 * 2. If the target section doesn't exist, append it at the end of the file.
 * 3. If CLAUDE.md doesn't exist, create it with a default header.
 *
 * The injection is idempotent: running it twice replaces existing markers.
 *
 * @param projectRoot - Path to the project root
 * @param skillName - Name of the skill (used in markers)
 * @param entries - Array of { section, content } to inject
 * @returns List of modified/created files (always ["CLAUDE.md"] if any entries)
 */
export async function injectClaudeMd(
  projectRoot: string,
  skillName: string,
  entries: Array<{ section: string; content: string }>,
): Promise<string[]> {
  if (!entries || entries.length === 0) {
    return [];
  }

  let content = await readClaudeMd(projectRoot);

  // Create CLAUDE.md with default header if it doesn't exist
  if (content === null) {
    content = DEFAULT_HEADER;
  }

  // First, remove any existing blocks for this skill (idempotent)
  let changed = true;
  while (changed) {
    const result = removeSkillBlock(content, skillName);
    changed = result.found;
    content = result.content;
  }

  // Now inject each entry
  for (const entry of entries) {
    const block = [
      startMarker(skillName),
      entry.content,
      endMarker(skillName),
    ].join("\n");

    const section = findSection(content, entry.section);

    if (section) {
      // Section exists — append block at the end of the section
      const insertPos = section.end;

      // Ensure there's a blank line before the block
      let prefix = "";
      const beforeInsert = content.slice(0, insertPos);
      if (!beforeInsert.endsWith("\n\n")) {
        if (beforeInsert.endsWith("\n")) {
          prefix = "\n";
        } else {
          prefix = "\n\n";
        }
      }

      content =
        content.slice(0, insertPos) +
        prefix +
        block +
        "\n" +
        content.slice(insertPos);
    } else {
      // Section doesn't exist — append at the end of the file
      let prefix = "";
      if (!content.endsWith("\n\n")) {
        if (content.endsWith("\n")) {
          prefix = "\n";
        } else {
          prefix = "\n\n";
        }
      }

      content += prefix + entry.section + "\n" + block + "\n";
    }
  }

  await writeClaudeMd(projectRoot, content);

  return [CLAUDE_MD];
}

/**
 * Remove all skillx-injected blocks for a given skill from CLAUDE.md.
 *
 * After removing blocks:
 * - Cleans up extra blank lines left behind
 * - If a section header now has no content below it (only whitespace before
 *   the next ## or EOF), remove the section header too
 * - Does NOT delete CLAUDE.md even if empty
 *
 * @param projectRoot - Path to the project root
 * @param skillName - Name of the skill whose blocks should be removed
 * @returns List of modified files (["CLAUDE.md"] if modified, [] if nothing to do)
 */
export async function removeClaudeMd(
  projectRoot: string,
  skillName: string,
): Promise<string[]> {
  let content = await readClaudeMd(projectRoot);

  if (content === null) {
    return [];
  }

  // Remove all blocks for this skill
  let anyFound = false;
  let changed = true;
  while (changed) {
    const result = removeSkillBlock(content, skillName);
    changed = result.found;
    if (changed) {
      anyFound = true;
    }
    content = result.content;
  }

  if (!anyFound) {
    return [];
  }

  // Clean up empty sections:
  // A section heading followed by only whitespace before the next ## or EOF
  // should be removed.
  content = removeEmptySections(content);

  // Clean up excessive blank lines (more than 2 consecutive newlines → 2)
  content = content.replace(/\n{3,}/g, "\n\n");

  // Trim trailing whitespace but keep a final newline
  content = content.trimEnd() + "\n";

  await writeClaudeMd(projectRoot, content);

  return [CLAUDE_MD];
}

/**
 * Remove section headers (## ...) that have no content below them
 * (only whitespace before the next ## heading or EOF).
 */
function removeEmptySections(content: string): string {
  // Split into lines for processing
  const lines = content.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this is a section heading (## level)
    if (/^## /.test(line)) {
      // Look ahead to see if there is any non-blank content before the next ## or EOF
      let j = i + 1;
      let hasContent = false;

      while (j < lines.length) {
        if (/^## /.test(lines[j])) {
          // Hit the next section heading — stop looking
          break;
        }
        if (lines[j].trim() !== "") {
          hasContent = true;
          break;
        }
        j++;
      }

      if (!hasContent) {
        // Skip this empty section heading and any blank lines after it
        i = j;
        continue;
      }
    }

    result.push(line);
    i++;
  }

  return result.join("\n");
}
