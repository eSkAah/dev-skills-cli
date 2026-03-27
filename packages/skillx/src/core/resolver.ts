import type { SkillSpecifier } from "../types.js";
import { createOctokit } from "../utils/github.js";

/**
 * Parse a skill specifier string into its component parts.
 *
 * Supported formats:
 *   user/repo                   → { owner, repo }
 *   user/repo@v1.0.0           → { owner, repo, ref: "v1.0.0" }
 *   user/repo@abc1234          → { owner, repo, ref: "abc1234" }
 *   user/repo#main             → { owner, repo, ref: "main" }
 *   github:user/repo           → strip prefix, then parse as above
 *   user/repo:skill-name       → { owner, repo, skillName: "skill-name" }
 *   user/repo@v1.0.0:skill     → { owner, repo, ref: "v1.0.0", skillName: "skill" }
 */
export function parseSpecifier(input: string): SkillSpecifier {
  let spec = input.trim();

  // Strip optional "github:" prefix
  if (spec.startsWith("github:")) {
    spec = spec.slice("github:".length);
  }

  if (!spec || !spec.includes("/")) {
    throw new Error(
      `Invalid skill specifier "${input}". Expected format: user/repo`,
    );
  }

  let ref: string | undefined;
  let skillName: string | undefined;

  // Extract owner from "owner/rest"
  const slashIdx = spec.indexOf("/");
  const owner = spec.slice(0, slashIdx);
  const rest = spec.slice(slashIdx + 1);

  if (!owner) {
    throw new Error(
      `Invalid skill specifier "${input}". Missing owner.`,
    );
  }

  // Extract ref from @ or #
  // Patterns: rest = "repo@ref:skill", "repo#ref:skill", "repo:skill", "repo@ref", "repo#ref", "repo"
  // Order of parsing: first check for @ or #, then check for : (monorepo skill name)

  let repo: string;

  // Check for @ (tag/sha) or # (branch) delimiter
  const atIdx = rest.indexOf("@");
  const hashIdx = rest.indexOf("#");

  if (atIdx !== -1) {
    repo = rest.slice(0, atIdx);
    const afterRef = rest.slice(atIdx + 1);
    // afterRef could be "ref:skill" or "ref"
    const colonIdx = afterRef.indexOf(":");
    if (colonIdx !== -1) {
      ref = afterRef.slice(0, colonIdx);
      skillName = afterRef.slice(colonIdx + 1);
    } else {
      ref = afterRef;
    }
  } else if (hashIdx !== -1) {
    repo = rest.slice(0, hashIdx);
    const afterRef = rest.slice(hashIdx + 1);
    const colonIdx = afterRef.indexOf(":");
    if (colonIdx !== -1) {
      ref = afterRef.slice(0, colonIdx);
      skillName = afterRef.slice(colonIdx + 1);
    } else {
      ref = afterRef;
    }
  } else {
    // No ref delimiter — check for colon (monorepo skill name)
    const colonIdx = rest.indexOf(":");
    if (colonIdx !== -1) {
      repo = rest.slice(0, colonIdx);
      skillName = rest.slice(colonIdx + 1);
    } else {
      repo = rest;
    }
  }

  if (!repo) {
    throw new Error(
      `Invalid skill specifier "${input}". Missing repository name.`,
    );
  }

  // Validate ref and skillName are non-empty if present
  if (ref !== undefined && !ref) {
    throw new Error(
      `Invalid skill specifier "${input}". Empty ref after @ or #.`,
    );
  }
  if (skillName !== undefined && !skillName) {
    throw new Error(
      `Invalid skill specifier "${input}". Empty skill name after :.`,
    );
  }

  const result: SkillSpecifier = { owner, repo };
  if (ref) result.ref = ref;
  if (skillName) result.skillName = skillName;

  return result;
}

/**
 * Resolve the tarball download URL and commit SHA for a given skill specifier.
 *
 * Uses the GitHub API endpoint `GET /repos/{owner}/{repo}/tarball/{ref}`.
 * If no ref is provided, the default branch is used.
 *
 * Returns the redirect URL for the tarball and the resolved commit SHA.
 */
export async function resolveDownloadUrl(
  spec: SkillSpecifier,
  token?: string,
): Promise<{ url: string; sha: string }> {
  const octokit = createOctokit(token);

  // Determine the ref to use
  let ref = spec.ref;

  if (!ref) {
    // Fetch the default branch
    const { data: repoData } = await octokit.rest.repos.get({
      owner: spec.owner,
      repo: spec.repo,
    });
    ref = repoData.default_branch;
  }

  // Resolve the commit SHA for this ref
  const { data: refData } = await octokit.rest.repos.getCommit({
    owner: spec.owner,
    repo: spec.repo,
    ref,
  });
  const sha = refData.sha;

  // Build the tarball URL
  // The GitHub API redirects GET /repos/{owner}/{repo}/tarball/{ref} to a CDN URL.
  // We use the archive download URL directly.
  const url = `https://api.github.com/repos/${spec.owner}/${spec.repo}/tarball/${ref}`;

  return { url, sha };
}
