/** Supported platforms */
export type PlatformName = "claude" | "codex";

/** Parsed skill specifier from CLI input */
export interface SkillSpecifier {
  owner: string;
  repo: string;
  ref?: string; // tag, branch, or commit SHA
}

/** Skill manifest (skillx.json from the skill repo) */
export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  platforms: PlatformName[];
  keywords?: string[];
  monorepo?: boolean;
  skills?: SkillManifest[]; // monorepo only
  claude?: ClaudeConfig;
  codex?: CodexConfig;
  dependencies?: Record<string, string>;
  scripts?: { postinstall?: string };
}

export interface ClaudeConfig {
  skills?: string[];
  agents?: string[];
  claudemd?: {
    entries: ClaudeMdEntry[];
  };
}

export interface ClaudeMdEntry {
  section: string;
  content: string;
}

export interface CodexConfig {
  instructions?: string;
  agents?: string[];
  strategy?: "append" | "replace" | "section";
}

/** Project-level skillx.json (consumer project) */
export interface ProjectManifest {
  skills: Record<string, ProjectSkillEntry>;
}

export interface ProjectSkillEntry {
  source: string;
  version: string;
  platforms: PlatformName[];
}

/** Lockfile entry */
export interface LockfileEntry {
  source: string;
  version: string;
  resolved: string;
  sha: string;
  installedAt: string;
  files: Record<PlatformName, string[]>;
}

export interface Lockfile {
  lockfileVersion: number;
  skills: Record<string, LockfileEntry>;
}

/** Result of installing files for a platform */
export interface InstalledFiles {
  platform: PlatformName;
  files: string[];
}

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
