import type {
  InstalledFiles,
  PlatformName,
  SkillManifest,
  ValidationResult,
} from "../types.js";

/**
 * Platform interface — Strategy pattern for platform-specific operations.
 *
 * Each supported platform (Claude Code, Codex, etc.) implements this interface
 * to handle skill installation, uninstallation, listing, and validation
 * according to its own directory structure and conventions.
 */
export interface Platform {
  /** Platform identifier */
  name: PlatformName;

  /** Detect if this platform is used in the given project root */
  detect(projectRoot: string): Promise<boolean>;

  /** Install skill files for this platform into the project */
  install(
    skillManifest: SkillManifest,
    skillDir: string,
    projectRoot: string,
  ): Promise<InstalledFiles>;

  /** Uninstall skill files for this platform from the project */
  uninstall(
    skillName: string,
    installedFiles: string[],
    projectRoot: string,
  ): Promise<void>;

  /** List skills currently installed for this platform */
  list(
    projectRoot: string,
  ): Promise<Array<{ name: string; description: string; path: string }>>;

  /** Validate a skill directory for compatibility with this platform */
  validate(skillDir: string): Promise<ValidationResult>;
}

/** Registry of platform implementations, populated lazily */
const platformRegistry = new Map<PlatformName, () => Platform>();

/**
 * Register a platform implementation.
 * Called by each platform module to make itself available to the factory.
 */
export function registerPlatform(
  name: PlatformName,
  factory: () => Platform,
): void {
  platformRegistry.set(name, factory);
}

/**
 * Get a platform implementation by name.
 * Lazily imports the platform module on first access.
 *
 * @throws Error if the platform is not supported
 */
export async function getPlatform(name: PlatformName): Promise<Platform> {
  // Lazy-load platform modules to avoid circular dependencies
  // and to only load what's needed
  if (!platformRegistry.has(name)) {
    switch (name) {
      case "claude":
        await import("./claude.js");
        break;
      case "codex":
        // Codex platform is planned for Phase 2 (v0.2.0)
        throw new Error(
          `Platform "${name}" is not yet implemented. It is planned for v0.2.0.`,
        );
      default:
        throw new Error(
          `Unknown platform: "${name}". Supported platforms: claude, codex`,
        );
    }
  }

  const factory = platformRegistry.get(name);
  if (!factory) {
    throw new Error(`Platform "${name}" failed to register after import.`);
  }

  return factory();
}

/**
 * Detect which platforms are used in the given project root.
 * Returns a list of platform names that were detected.
 */
export async function detectPlatforms(
  projectRoot: string,
): Promise<PlatformName[]> {
  const allPlatforms: PlatformName[] = ["claude", "codex"];
  const detected: PlatformName[] = [];

  for (const name of allPlatforms) {
    try {
      const platform = await getPlatform(name);
      if (await platform.detect(projectRoot)) {
        detected.push(name);
      }
    } catch {
      // Platform not implemented yet — skip detection
    }
  }

  return detected;
}
