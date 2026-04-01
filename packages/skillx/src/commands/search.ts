import pc from "picocolors";
import type { ParsedArgs } from "../utils/args.js";
import { logger } from "../utils/logger.js";
import { resolveGitHubToken, createOctokit } from "../utils/github.js";
import type { PlatformName, SkillManifest } from "../types.js";

/** Metadata extracted from a skillx.json fetched from a repo. */
interface SearchResultMeta {
  name: string;
  description: string;
  version: string;
  platforms: PlatformName[];
}

/**
 * Format a platform name as a colored badge (same pattern as list.ts).
 */
function platformBadge(platform: PlatformName): string {
  switch (platform) {
    case "claude":
      return pc.cyan(platform);
    case "codex":
      return pc.magenta(platform);
    default:
      return pc.gray(platform);
  }
}

/**
 * Fetch and parse the skillx.json from a repo.
 * Returns metadata on success, null on failure.
 * Enforces a per-request timeout to avoid blocking.
 */
async function fetchSkillManifest(
  octokit: ReturnType<typeof createOctokit>,
  owner: string,
  repo: string,
  timeoutMs = 2000,
): Promise<SearchResultMeta | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: "skillx.json",
      request: { signal: controller.signal },
    });

    clearTimeout(timer);

    // getContent returns a file object when the path is a file
    const data = response.data;
    if (Array.isArray(data) || !("content" in data)) return null;

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    const manifest: SkillManifest = JSON.parse(content);

    return {
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      platforms: manifest.platforms ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * `skillx search <query>` — Search for skills on GitHub.
 *
 * Flags:
 *   --platform   Filter results to skills supporting this platform
 */
export async function searchCommand(args: ParsedArgs): Promise<void> {
  // 1. Build search query from positional args
  const query = args.positionals.join(" ").trim();

  if (!query) {
    logger.error(
      `Missing search query. Usage: ${pc.bold("skillx search <query>")}`,
    );
    process.exit(1);
  }

  // 2. Resolve GitHub token (optional — search works without auth)
  logger.debug("Resolving GitHub token...");
  const token = await resolveGitHubToken();

  if (token) {
    logger.debug("Authenticated — higher rate limits apply.");
  } else {
    logger.debug(
      "No GitHub token found — using anonymous access (lower rate limits).",
    );
  }

  // 3. Create Octokit instance
  const octokit = createOctokit(token ?? undefined);

  // 4. Search GitHub repositories with the skillx-skill topic
  const spinner = logger.spinner(`Searching for "${query}"...`);

  let repos: {
    full_name: string;
    owner: { login: string } | null;
    name: string;
    description: string | null;
    stargazers_count: number;
  }[];

  try {
    const result = await octokit.rest.search.repos({
      q: `topic:skillx-skill ${query}`,
      sort: "stars",
      order: "desc",
      per_page: 20,
    });
    repos = result.data.items;
  } catch (err) {
    spinner.stop();
    logger.error(
      `GitHub search failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  if (repos.length === 0) {
    spinner.stop();
    logger.info(
      `No skills found for '${query}'. Try a different search term.`,
    );
    return;
  }

  // Filter out repos with null owners (shouldn't happen, but API types allow it)
  const validRepos = repos.filter(
    (repo): repo is typeof repo & { owner: { login: string } } =>
      repo.owner !== null,
  );

  // 5. Fetch skillx.json for each repo in parallel (with timeout)
  logger.debug(`Fetching skillx.json for ${validRepos.length} repos...`);

  const metadataResults = await Promise.all(
    validRepos.map((repo) =>
      fetchSkillManifest(octokit, repo.owner.login, repo.name),
    ),
  );

  spinner.stop();

  // 6. Build display list, optionally filtering by platform
  const platformFilter = args.flags.platform;

  interface DisplayEntry {
    fullName: string;
    description: string;
    version: string;
    platforms: PlatformName[];
    stars: number;
  }

  const entries: DisplayEntry[] = [];

  for (let i = 0; i < validRepos.length; i++) {
    const repo = validRepos[i];
    const meta = metadataResults[i];

    const entry: DisplayEntry = {
      fullName: repo.full_name,
      description: meta?.description ?? repo.description ?? "",
      version: meta?.version ? `v${meta.version.replace(/^v/, "")}` : "",
      platforms: meta?.platforms ?? [],
      stars: repo.stargazers_count,
    };

    // Apply platform filter
    if (platformFilter && platformFilter !== "all") {
      if (
        entry.platforms.length > 0 &&
        !entry.platforms.includes(platformFilter as PlatformName)
      ) {
        continue;
      }
    }

    entries.push(entry);
  }

  if (entries.length === 0) {
    logger.info(
      `No skills found for '${query}'. Try a different search term.`,
    );
    return;
  }

  // 7. Compute column widths for aligned output
  const nameWidth = Math.max(...entries.map((e) => e.fullName.length));
  const versionWidth = Math.max(
    ...entries.map((e) => e.version.length),
    0,
  );

  // 8. Display formatted results
  console.log();
  console.log(
    pc.bold(`Search results for "${query}" (${entries.length} found):`),
  );
  console.log();

  for (const entry of entries) {
    // Line 1: name + version
    const nameCol = pc.bold(entry.fullName.padEnd(nameWidth));
    const versionCol = entry.version
      ? pc.dim(entry.version.padStart(versionWidth))
      : "";
    console.log(`  ${nameCol}  ${versionCol}`);

    // Line 2: description
    if (entry.description) {
      console.log(`  ${pc.dim(entry.description)}`);
    }

    // Line 3: platforms + stars
    const platformsStr =
      entry.platforms.length > 0
        ? entry.platforms.map(platformBadge).join(" ")
        : pc.dim("unknown");
    const starsStr = pc.yellow(`★ ${entry.stars}`);
    console.log(`  ${platformsStr}${" ".repeat(Math.max(1, nameWidth - stripAnsi(platformsStr).length - stripAnsi(starsStr).length + 2))}${starsStr}`);

    console.log();
  }
}

/**
 * Strip ANSI escape codes for length calculations.
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, "");
}
