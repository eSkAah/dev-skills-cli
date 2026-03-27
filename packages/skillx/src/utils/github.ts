import { Octokit } from "octokit";

/**
 * Resolve a GitHub token from the environment or the gh CLI.
 *
 * Resolution cascade:
 *   1. SKILLX_GITHUB_TOKEN env var
 *   2. GITHUB_TOKEN env var
 *   3. `gh auth token` CLI command
 *   4. null (anonymous access)
 */
export async function resolveGitHubToken(): Promise<string | null> {
  // 1. SKILLX_GITHUB_TOKEN
  const skillxToken = process.env.SKILLX_GITHUB_TOKEN;
  if (skillxToken) return skillxToken;

  // 2. GITHUB_TOKEN
  const ghToken = process.env.GITHUB_TOKEN;
  if (ghToken) return ghToken;

  // 3. gh auth token
  try {
    const proc = Bun.spawn(["gh", "auth", "token"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode === 0) {
      const text = await new Response(proc.stdout).text();
      const token = text.trim();
      if (token) return token;
    }
  } catch {
    // gh CLI not installed or not available — fall through
  }

  // 4. No token found
  return null;
}

/**
 * Create an Octokit instance, optionally authenticated with a token.
 */
export function createOctokit(token?: string): Octokit {
  return new Octokit(token ? { auth: token } : {});
}
