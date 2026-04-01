# skillx — Workflow de développement

> Ce document est la source de vérité pour l'avancement du projet.
> Claude Code doit le lire au début de chaque session pour reprendre là où on s'est arrêté.
> Chaque task est marquée avec un statut : `[ ]` (à faire), `[~]` (en cours), `[x]` (terminée).

**Repo** : `/Users/allan/Workspace/ia-sandbox`
**PRD** : `PRD.md`
**Stack** : Bun + TypeScript

## Conventions Gitflow

| Branche | Usage |
|---------|-------|
| `main` | Production — releases uniquement |
| `develop` | Intégration — toutes les features mergent ici |
| `feature/T-XXX-description` | Feature branches — une par task ou groupe de tasks |
| `release/vX.Y.Z` | Stabilisation avant release |
| `hotfix/description` | Fix urgent en production |

**Merge strategy** : merge commit `--no-ff` (préserve l'historique des branches)
**Commits** : Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
**PR** : chaque groupe de tasks liées → 1 feature branch → 1 PR vers `develop`

---

## Phase 1 — MVP (v0.1.0) — Claude Code uniquement

### Milestone 1 : Setup projet

- [x] **T-001** — Initialiser le projet Bun + TypeScript
  - Créer `package.json` avec name `skillx`, bin entry, type module
  - Créer `tsconfig.json` (strict, ESNext, bundler resolution)
  - Créer `bunfig.toml` si nécessaire
  - Installer les dépendances : `@clack/prompts`, `octokit`, `yaml`, `tar`, `chalk`
  - Structure de dossiers : `src/`, `src/commands/`, `src/core/`, `src/platforms/`, `src/utils/`
  - Fichier : `src/index.ts` (entry point vide)

- [x] **T-002** — CLI entry point + routing des commandes
  - Parser les arguments (Bun.argv ou lib légère)
  - Router vers les commandes : `install`, `uninstall`, `list`, `auth`
  - Gestion de `--help`, `--version`
  - Alias courts : `i` → `install`, `un` → `uninstall`, `ls` → `list`
  - Fichiers : `src/index.ts`, `src/commands/index.ts`

### Milestone 2 : Core — résolution et téléchargement

- [x] **T-003** — GitHub resolver
  - Parser les specifiers : `user/repo`, `user/repo@v1.0.0`, `user/repo@sha`, `user/repo#branch`
  - Résoudre vers une URL tarball GitHub API
  - Support des repos privés (injection du token dans le header Authorization)
  - Fichiers : `src/core/resolver.ts`
  - Types : `SkillSpecifier { owner, repo, ref?, tag?, sha? }`

- [x] **T-004** — Auth GitHub (résolution du token)
  - Cascade : `SKILLX_GITHUB_TOKEN` → `GITHUB_TOKEN` → `gh auth token` → erreur
  - Fonction `resolveGitHubToken(): Promise<string | null>`
  - Fichiers : `src/utils/github.ts`

- [x] **T-005** — Downloader (téléchargement + extraction)
  - Télécharger le tarball via GitHub API (avec auth si nécessaire)
  - Extraire dans un dossier temporaire (`os.tmpdir()`)
  - Retourner le chemin du dossier extrait
  - Nettoyer le dossier temporaire après usage
  - Fichiers : `src/core/downloader.ts`

### Milestone 3 : Core — manifests et lockfile

- [x] **T-006** — Skill manifest reader (lire le skillx.json du skill)
  - Lire et valider le `skillx.json` du skill téléchargé
  - Parser le format single-skill et monorepo
  - Type : `SkillManifest { name, version, description, platforms, claude?, codex?, ... }`
  - Fichiers : `src/core/manifest.ts`

- [x] **T-007** — Validator (validation du skillx.json)
  - Valider les champs requis : `name`, `version`, `description`, `platforms`
  - Valider que les chemins référencés existent (skills, agents)
  - Valider les SKILL.md (frontmatter YAML parsable, `name` et `description` présents)
  - Retourner des erreurs claires et actionables
  - Fichiers : `src/core/validator.ts`

- [x] **T-008** — Project manifest (skillx.json du projet consommateur)
  - Lire / créer / mettre à jour le `skillx.json` à la racine du projet
  - Ajouter / retirer des entrées dans `skills`
  - Format : `{ skills: { [name]: { source, version, platforms } } }`
  - Fichiers : `src/core/project-manifest.ts`

- [x] **T-009** — Lockfile (skillx.lock)
  - Lire / créer / mettre à jour le `skillx.lock`
  - Stocker : source, version, resolved URL, SHA, date, liste des fichiers installés
  - Fichiers : `src/core/lockfile.ts`

### Milestone 4 : Platform — Claude Code

- [x] **T-010** — Platform interface
  - Définir l'interface `Platform` (detect, install, uninstall, list, validate)
  - Fichiers : `src/platforms/platform.ts`

- [x] **T-011** — Claude Code platform implementation
  - `detect()` : vérifier si `.claude/` existe
  - `install()` : copier les skills dans `.claude/skills/`, les agents dans `.claude/agents/`
  - Gérer les sub-skills (copie récursive des dossiers)
  - `uninstall()` : supprimer les dossiers/fichiers installés (basé sur le lockfile)
  - `list()` : lister les skills dans `.claude/skills/` avec leurs metadata (parse frontmatter)
  - Fichiers : `src/platforms/claude.ts`

### Milestone 5 : Commandes CLI

- [x] **T-012** — Commande `install`
  - Flow complet : parse specifier → resolve → download → extract → read manifest → validate → install platform → update project manifest → update lockfile
  - Afficher la progression avec spinners (@clack/prompts)
  - Gérer les erreurs à chaque étape (messages clairs)
  - Gérer le conflit de nom (skill déjà installé → proposer `--force`)
  - Fichiers : `src/commands/install.ts`

- [x] **T-013** — Commande `uninstall`
  - Lire le lockfile pour trouver les fichiers installés
  - Appeler `platform.uninstall()`
  - Mettre à jour le project manifest et le lockfile
  - Erreur claire si le skill n'est pas installé
  - Fichiers : `src/commands/uninstall.ts`

- [x] **T-014** — Commande `list`
  - Lire le project manifest (`skillx.json`)
  - Afficher : nom, version, source, plateformes
  - Option `--verbose` : ajouter les fichiers installés (depuis lockfile)
  - Fichiers : `src/commands/list.ts`

- [x] **T-015** — Commande `auth`
  - `skillx auth` : afficher le statut d'authentification (token trouvé ? source ?)
  - `skillx auth login` : vérifier si `gh` est installé, lancer `gh auth login`
  - Fichiers : `src/commands/auth.ts`

### Milestone 6 : Logging et UX

- [x] **T-016** — Logger et formatage de sortie
  - Wrapper autour de `@clack/prompts` pour spinners, succès, erreurs, warnings
  - Couleurs cohérentes : vert (succès), rouge (erreur), jaune (warning), bleu (info)
  - Mode `--quiet` (sortie minimale) et `--verbose` (sortie détaillée)
  - Fichiers : `src/utils/logger.ts`

### Milestone 7 : Build et distribution

- [x] **T-017** — Build setup
  - Configurer `bun build` pour produire un single executable
  - Script `build` dans package.json
  - Tester que `bunx skillx` fonctionne
  - Tester que `npx skillx` et `pnpx skillx` fonctionnent

- [x] **T-018** — Tests
  - Tests unitaires pour : resolver, manifest reader, validator, lockfile
  - Tests d'intégration pour : install flow complet (avec un repo fixture)
  - Créer un repo GitHub fixture public pour les tests
  - Fichiers : `tests/`

### Milestone 8 : Documentation

- [x] **T-019** — README.md du projet skillx
  - Installation (`bun add -g skillx` / `npx skillx`)
  - Quick start
  - Commandes disponibles
  - Comment créer un skill package
  - Format `skillx.json`

---

## Phase 2 — Multi-plateforme (v0.2.0) — Codex

- [ ] **T-020** — Codex platform implementation
  - `detect()` : vérifier si `.codex/` ou `AGENTS.md` existe
  - `install()` : injecter dans AGENTS.md (stratégie section) + copier agents TOML
  - `uninstall()` : retirer la section du AGENTS.md + supprimer agents TOML
  - Fichiers : `src/platforms/codex.ts`

- [x] **T-021** — CLAUDE.md injection
  - Lire les entrées `claudemd` du manifest
  - Injecter les sections dans le bon emplacement de CLAUDE.md
  - Gérer la désinstallation (retirer les blocs `<!-- skillx:name -->`)
  - Fichiers : `src/core/claudemd.ts` (new), `src/platforms/claude.ts` (extension)

- [ ] **T-022** — Commande `update`
  - Comparer le SHA lockfile vs latest sur GitHub
  - Réinstaller si différent
  - Option `--check` (dry run)
  - Fichiers : `src/commands/update.ts`

- [ ] **T-023** — Commande `search`
  - GitHub API Search : `topic:skillx-skill <query>`
  - Fetch le `skillx.json` de chaque résultat pour enrichir l'affichage
  - Fichiers : `src/commands/search.ts`

- [ ] **T-024** — Flag `--platform` sur install/uninstall
  - Filtrer les plateformes lors de l'installation
  - Auto-détection si `--platform` n'est pas spécifié

---

## Phase 3 — Monorepo & Publication (v0.3.0)

- [ ] **T-025** — Support monorepo
  - Parser le format `skillx.json` monorepo (`"monorepo": true` + `skills[]`)
  - Syntax `skillx install user/repo:skill-name`
  - `skillx install user/repo --list` pour lister les skills disponibles
  - Fichiers : `src/core/manifest.ts` (extension), `src/commands/install.ts` (extension)

- [ ] **T-026** — Commande `init` (wizard)
  - Wizard interactif avec @clack/prompts
  - Scaffolding : skillx.json, SKILL.md, AGENTS.md, structure de dossiers
  - Support sub-skills
  - Fichiers : `src/commands/init.ts`

- [ ] **T-027** — Commande `publish`
  - `--check` : validation complète (lint skillx.json, SKILL.md, structure)
  - Guide : vérifier topic GitHub, suggérer tag/release
  - Fichiers : `src/commands/publish.ts`

---

## Phase 4 — Écosystème (v1.0.0)

- [ ] **T-028** — Site web / marketplace
- [ ] **T-029** — Statistiques de téléchargement
- [ ] **T-030** — Skills vérifiés / certifiés
- [ ] **T-031** — Support nouvelles plateformes (Cursor, Windsurf)
- [ ] **T-032** — Sources additionnelles (npm, URL directe)

---

## Journal de session

> Chaque session de développement est logguée ici pour assurer la continuité.

| Date | Tasks | Notes |
|------|-------|-------|
| 2026-03-27 | PRD rédigé, WORKFLOW créé | Définition du projet, aucun code écrit encore |
| 2026-03-27 | T-001 terminée | Setup projet Bun+TS dans packages/skillx/, dépendances installées, CLI help fonctionne |
| 2026-03-27 | T-010, T-011 terminées | Platform interface + Claude Code implementation (detect, install, uninstall, list, validate) |
| 2026-03-27 | T-006, T-007, T-008, T-009 terminées | Manifest reader, validator, project manifest, lockfile — Milestone 3 complet |
| 2026-03-27 | T-003, T-004, T-005 terminées | GitHub resolver (specifier parser + download URL), auth (token cascade), downloader (tarball fetch + extract) |
| 2026-03-27 | T-002, T-016 terminées | CLI routing avec arg parser, command stubs (install/uninstall/list/auth), logger avec picocolors + @clack/prompts |
| 2026-03-27 | T-013 terminée | Commande uninstall: lockfile lookup, platform uninstall per-platform, manifest cleanup, confirmation prompt avec --force bypass |
| 2026-03-27 | T-014, T-015 terminées | Commande `list` (table formatée, --verbose lockfile, --platform filter) + commande `auth` (status avec source detection, login via gh CLI) |
| 2026-03-27 | T-012 terminée | Commande install complète : parse specifier, resolve, download, extract, manifest read, monorepo support, validate, platform install, project manifest + lockfile update, cleanup |
| 2026-03-27 | T-019 terminée | README.md complet : quick start, installation, commandes (install/uninstall/list/auth), options globales, création de skill package, plateformes supportées, authentification |
| 2026-03-27 | T-018 terminée | 77 unit tests (bun:test) : resolver (parseSpecifier), manifest (readSkillManifest, getSkillFromMonorepo), validator (validateSkillManifest), lockfile (CRUD), project-manifest (CRUD), args (parseArgs aliases/flags/positionals) |
| 2026-03-27 | T-017 terminée | Build setup: shebang node, bun build --target node produit dist/index.js, typecheck clean, integration vérifiée entre tous les modules, .gitignore ajouté |
| 2026-03-27 | **PHASE 1 COMPLETE** | 19 tasks, 10 PRs mergées dans develop, 77 tests passent, build 0.70MB fonctionne. Prêt pour Phase 2 (Codex, update, search) |
| 2026-03-27 | T-021 terminée | CLAUDE.md injection: `src/core/claudemd.ts` (injectClaudeMd + removeClaudeMd), intégration dans `claude.ts` (install/uninstall), 20 tests unitaires, idempotent, multi-skill coexistence, empty section cleanup |

