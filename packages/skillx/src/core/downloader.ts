import { mkdtemp, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { extract } from "tar";

/**
 * Download a tarball from a URL and extract it to a temporary directory.
 *
 * Steps:
 *   1. Fetch the tarball (with Authorization header if token provided)
 *   2. Write to a temp file in os.tmpdir()
 *   3. Extract into a temp directory using the `tar` package
 *   4. Return the path to the extracted directory (first directory inside the tar)
 *
 * @param url    The tarball download URL (GitHub API tarball endpoint)
 * @param token  Optional GitHub token for private repos
 * @returns      Path to the extracted directory
 */
export async function downloadAndExtract(
  url: string,
  token?: string,
): Promise<string> {
  // Build request headers
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "skillx-cli",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Fetch the tarball
  const response = await fetch(url, { headers, redirect: "follow" });

  if (!response.ok) {
    throw new Error(
      `Failed to download tarball: ${response.status} ${response.statusText}`,
    );
  }

  if (!response.body) {
    throw new Error("Empty response body when downloading tarball");
  }

  // Create temp directory for extraction
  const extractDir = await mkdtemp(join(tmpdir(), "skillx-"));

  // Write tarball to a temp file
  const tarballPath = join(extractDir, "archive.tar.gz");

  const body = response.body as ReadableStream<Uint8Array>;
  const reader = body.getReader();
  const writeStream = createWriteStream(tarballPath);

  try {
    // Stream the response body to a file
    const nodeReadable = new Readable({
      async read() {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
        } else {
          this.push(Buffer.from(value));
        }
      },
    });

    await pipeline(nodeReadable, writeStream);
  } catch (error) {
    // Clean up on download failure
    await rm(extractDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(
      `Failed to write tarball to disk: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Extract the tarball
  try {
    await extract({
      file: tarballPath,
      cwd: extractDir,
    });
  } catch (error) {
    await rm(extractDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(
      `Failed to extract tarball: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Find the extracted directory (GitHub tarballs contain a single top-level directory)
  const entries = await readdir(extractDir);
  const dirs = entries.filter((e) => e !== "archive.tar.gz");

  if (dirs.length === 0) {
    await rm(extractDir, { recursive: true, force: true }).catch(() => {});
    throw new Error("Tarball extraction produced no directories");
  }

  // Return the path to the first (and typically only) extracted directory
  return join(extractDir, dirs[0]);
}

/**
 * Clean up a previously extracted temporary directory.
 *
 * Removes the parent temp directory (which contains both the tarball and extracted content).
 *
 * @param extractedPath  Path returned by downloadAndExtract
 */
export async function cleanup(extractedPath: string): Promise<void> {
  try {
    // The extractedPath is something like /tmp/skillx-XXXXXX/owner-repo-sha
    // We want to remove the parent /tmp/skillx-XXXXXX directory
    const parentDir = join(extractedPath, "..");
    await rm(parentDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup — silently ignore errors
  }
}
