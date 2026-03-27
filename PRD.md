# skillx — PRD (Product Requirements Document)

> CLI pour installer, gérer et publier des skills pour AI coding assistants (Claude Code + Codex)

**Version**: 0.1.0 (Draft)
**Date**: 2026-03-27
**Stack**: Bun + TypeScript

---

## 1. Vision

**skillx** est un gestionnaire de packages pour les skills et agents des AI coding assistants. Il permet d'installer, mettre à jour, créer et publier des skills depuis GitHub, en les plaçant automatiquement dans la bonne structure de fichiers selon la plateforme cible (Claude Code ou Codex).

**Analogie** : skillx est à `.claude/skills/` ce que npm est à `node_modules/` — un outil qui standardise la distribution et l'installation de composants réutilisables.

---

## 2. Problèmes résolus

| Problème | Solution skillx |
|----------|----------------|
| Installation manuelle (copier/coller des SKILL.md) | `skillx install user/repo` |
| Pas de standard de distribution | Convention `skillx.json` + topic GitHub `skillx-skill` |
| Pas de versioning | Lockfile avec commit SHA / tags |
| Multi-plateforme complexe | Un seul skill repo avec dossiers `claude/` et `codex/` |
| Pas de découverte centralisée | `skillx search <query>` via GitHub API |
| Pas de scaffolding | `skillx init` pour créer un skill bien structuré |

---

## 3. Plateformes cibles

### 3.1 Claude Code

**Structure d'installation :**
```
.claude/
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md          # Fichier principal (frontmatter YAML)
│       ├── sub-skill/
│       │   └── SKILL.md
│       └── scripts/          # Scripts optionnels
└── agents/
    └── <agent-name>.md       # Agents (frontmatter YAML)
```

**Frontmatter SKILL.md :**
```yaml
---
name: skill-identifier
description: Quand et pourquoi utiliser ce skill
allowed-tools: Read, Grep, Bash
model: sonnet
# ... autres champs supportés
---
```

### 3.2 Codex (OpenAI)

**Structure d'installation :**
```
AGENTS.md                     # Instructions au root du projet
.codex/
├── config.toml               # Configuration TOML (optionnel)
└── agents/                   # Agents custom (fichiers TOML)
    └── <agent-name>.toml
```

**Instructions (AGENTS.md)** : Markdown pur, pas de frontmatter requis. Codex découvre les fichiers `AGENTS.md` en parcourant l'arborescence root → cwd.

**Priorité** : `AGENTS.override.md` > `AGENTS.md` > fallbacks configurables.

**Agents (.codex/agents/)** : Fichiers TOML individuels définissant des agents spécialisés. Chaque fichier peut spécifier : `name`, `description`, `developer_instructions`, `model`, `sandbox_mode`, `mcp_servers`. Agents disponibles globalement dans `~/.codex/agents/` ou par projet dans `.codex/agents/`.

---

## 4. Format d'un skill package

Chaque skill est un repo GitHub avec cette structure :

```
my-awesome-skill/
├── skillx.json               # Manifest du skill (requis)
├── README.md                 # Documentation
├── claude/                   # Fichiers Claude Code
│   ├── skills/
│   │   └── my-skill/
│   │       ├── SKILL.md
│   │       └── sub-skill/
│   │           └── SKILL.md
│   └── agents/               # Optionnel
│       └── my-agent.md
└── codex/                    # Fichiers Codex
    ├── AGENTS.md             # Instructions markdown
    └── agents/               # Agents custom (optionnel)
        └── my-agent.toml     # Agent TOML Codex
```

### 4.1 skillx.json (manifest)

```jsonc
{
  "name": "blazor-best-practices",
  "version": "1.0.0",
  "description": "Blazor .NET 8/9 development skills with sub-skills for components, state, testing, etc.",
  "author": "allan",
  "license": "MIT",
  "platforms": ["claude", "codex"],
  "keywords": ["blazor", "dotnet", "csharp", "best-practices"],

  // Contenu du skill par plateforme
  "claude": {
    "skills": ["claude/skills/"],         // Dossiers à copier dans .claude/skills/
    "agents": ["claude/agents/"]          // Fichiers à copier dans .claude/agents/
  },
  "codex": {
    "instructions": "codex/AGENTS.md",   // Fichier à merger/copier
    "agents": ["codex/agents/"],          // Fichiers TOML à copier dans .codex/agents/
    "strategy": "section"                 // append | replace | section
  },

  // Dépendances optionnelles vers d'autres skills
  "dependencies": {
    "typescript-conventions": "github:user/ts-conventions"
  },

  // Hooks de post-installation (optionnel)
  "scripts": {
    "postinstall": "echo 'Skill installed successfully!'"
  }
}
```

### 4.2 Stratégies d'installation Codex

Comme Codex utilise un seul `AGENTS.md` (pas de dossier par skill), skillx doit gérer la fusion :

| Stratégie | Comportement |
|-----------|-------------|
| `append` | Ajoute une section délimitée à la fin du `AGENTS.md` existant |
| `replace` | Remplace tout le `AGENTS.md` (destructif, avec confirmation) |
| `section` | Insère/met à jour une section nommée `<!-- skillx:skill-name -->` |

**Format de section injectée (stratégie `section` — recommandée) :**
```markdown
<!-- skillx:blazor-best-practices:start -->
## Blazor Best Practices
[contenu du skill]
<!-- skillx:blazor-best-practices:end -->
```

---

## 5. CLI — Commandes

### 5.1 Installation

```bash
# Installer depuis GitHub
skillx install github:user/repo
skillx install github:user/repo@v1.2.0      # Tag spécifique
skillx install github:user/repo@abc1234      # Commit spécifique
skillx install github:user/repo#main         # Branche spécifique

# Raccourci (sans préfixe github:)
skillx install user/repo

# Installer pour une plateforme spécifique
skillx install user/repo --platform claude
skillx install user/repo --platform codex
skillx install user/repo --platform all      # Défaut

# Alias court
skillx i user/repo
```

**Comportement :**
1. Clone/télécharge le repo (via GitHub API tarball, pas git clone)
2. Lit `skillx.json` pour déterminer les fichiers à copier
3. Copie les fichiers dans la bonne structure selon la plateforme
4. Met à jour `skillx.json` (projet) et `skillx.lock`
5. Exécute le hook `postinstall` si défini

### 5.2 Désinstallation

```bash
skillx uninstall blazor-best-practices
skillx un blazor-best-practices              # Alias court
skillx uninstall blazor-best-practices --platform codex  # Une seule plateforme
```

**Comportement :**
1. Supprime les fichiers/dossiers installés
2. Pour Codex : retire la section du `AGENTS.md`
3. Met à jour `skillx.json` et `skillx.lock`

### 5.3 Mise à jour

```bash
skillx update                                 # Tous les skills
skillx update blazor-best-practices          # Un skill spécifique
skillx update --check                         # Vérifier sans installer (dry run)
```

### 5.4 Listing

```bash
skillx list                                   # Skills installés
skillx list --platform claude                # Filtre par plateforme
skillx list --verbose                         # Avec versions, source, plateforme
skillx ls                                     # Alias court
```

**Exemple de sortie :**
```
Installed skills (3):

  blazor-best-practices  v1.0.0  github:allan/blazor-bp   claude codex
  react-hooks            v2.1.0  github:user/react-hooks  claude
  ts-conventions         v0.3.0  github:user/ts-conv      codex

```

### 5.5 Recherche

```bash
skillx search blazor                         # Cherche sur GitHub (topic: skillx-skill)
skillx search "react testing"
skillx search --platform codex               # Filtre par plateforme supportée
```

**Comportement :**
- Utilise l'API GitHub Search : `topic:skillx-skill <query>`
- Affiche nom, description, stars, plateformes supportées

### 5.6 Initialisation (créer un skill)

```bash
skillx init                                   # Wizard interactif
skillx init --name my-skill --platforms claude,codex
```

**Wizard interactif :**
```
? Nom du skill : my-awesome-skill
? Description : Best practices for awesome development
? Plateformes : ☑ Claude Code  ☑ Codex
? Auteur : allan
? Sous-skills ? (oui/non) : oui
? Noms des sous-skills (séparés par virgule) : component, testing, architecture

Creating skill structure...

my-awesome-skill/
├── skillx.json
├── README.md
├── claude/
│   └── skills/
│       └── my-awesome-skill/
│           ├── SKILL.md
│           ├── component/
│           │   └── SKILL.md
│           ├── testing/
│           │   └── SKILL.md
│           └── architecture/
│               └── SKILL.md
└── codex/
    └── AGENTS.md

✓ Skill scaffolded! Edit the SKILL.md files, then publish with: skillx publish
```

### 5.7 Publication

```bash
skillx publish                                # Vérifie et guide la publication sur GitHub
skillx publish --check                        # Validation seulement (lint)
```

**Comportement :**
1. Valide le `skillx.json` (champs requis, structure)
2. Vérifie que les fichiers référencés existent
3. Lint les SKILL.md (frontmatter valide, taille < 500 lignes)
4. Guide l'utilisateur pour ajouter le topic `skillx-skill` sur GitHub
5. Suggère de créer un tag/release

---

## 6. Fichiers projet

### 6.1 skillx.json (projet — racine du workspace)

Installé à la racine du projet consommateur pour tracker les skills installés :

```jsonc
{
  "skills": {
    "blazor-best-practices": {
      "source": "github:allan/blazor-bp",
      "version": "v1.0.0",
      "platforms": ["claude", "codex"]
    },
    "react-hooks": {
      "source": "github:user/react-hooks",
      "version": "v2.1.0",
      "platforms": ["claude"]
    }
  }
}
```

### 6.2 skillx.lock

```jsonc
{
  "lockfileVersion": 1,
  "skills": {
    "blazor-best-practices": {
      "source": "github:allan/blazor-bp",
      "version": "v1.0.0",
      "resolved": "https://github.com/allan/blazor-bp/archive/abc1234.tar.gz",
      "sha": "abc1234567890abcdef",
      "installedAt": "2026-03-27T10:00:00Z",
      "files": {
        "claude": [
          ".claude/skills/blazor-best-practices/SKILL.md",
          ".claude/skills/blazor-best-practices/blazor-component/SKILL.md",
          ".claude/skills/blazor-best-practices/blazor-state/SKILL.md"
        ],
        "codex": [
          "AGENTS.md#skillx:blazor-best-practices"
        ]
      }
    }
  }
}
```

---

## 7. Gestion des conflits

### 7.1 Claude Code

Pas de conflit structurel — chaque skill a son propre dossier dans `.claude/skills/`.

**Conflit possible** : deux skills avec le même `name` dans le frontmatter.
**Résolution** : skillx refuse l'installation et suggère un alias (`--as <name>`).

### 7.2 Codex

**Conflit fréquent** : fusion dans un seul `AGENTS.md`.
**Résolution** : la stratégie `section` avec balises `<!-- skillx:name:start/end -->` permet d'isoler chaque skill. skillx ne touche jamais au contenu hors de ses balises.

---

## 8. Découverte sur GitHub

### 8.1 Convention

- **Topic GitHub** : `skillx-skill` (requis pour apparaître dans `skillx search`)
- **Fichier** : `skillx.json` à la racine du repo (requis)
- **Topics additionnels recommandés** : `claude-code`, `codex`, `ai-skills`

### 8.2 API GitHub Search

```
GET /search/repositories?q=topic:skillx-skill+<query>&sort=stars
```

Résultat enrichi avec le contenu de `skillx.json` (fetch via raw content API).

---

## 9. Architecture technique

### 9.1 Stack

| Composant | Choix | Justification |
|-----------|-------|---------------|
| Runtime | **Bun** | Rapide, TypeScript natif, bundler intégré |
| CLI framework | **@clack/prompts** | UX interactive moderne (wizard, spinners) |
| GitHub API | **octokit** | Client officiel, auth token support |
| File ops | **Bun fs** | API native rapide |
| Parsing YAML | **yaml** | Pour parser les frontmatter SKILL.md |
| Parsing TOML | **smol-toml** | Pour les config Codex |
| Tar extraction | **tar** | Extraire les tarballs GitHub |
| Distribution | **npm registry** | `bunx skillx` / `pnpx skillx` / `npx skillx` |

### 9.2 Structure du projet

```
skillx/
├── src/
│   ├── index.ts                  # Entry point CLI
│   ├── commands/
│   │   ├── install.ts
│   │   ├── uninstall.ts
│   │   ├── update.ts
│   │   ├── list.ts
│   │   ├── search.ts
│   │   ├── init.ts
│   │   └── publish.ts
│   ├── platforms/
│   │   ├── platform.ts           # Interface commune
│   │   ├── claude.ts             # Logique Claude Code
│   │   └── codex.ts              # Logique Codex
│   ├── core/
│   │   ├── manifest.ts           # Lecture/écriture skillx.json
│   │   ├── lockfile.ts           # Gestion du lockfile
│   │   ├── resolver.ts           # Résolution GitHub → tarball
│   │   ├── downloader.ts         # Download + extraction
│   │   └── validator.ts          # Validation skillx.json + SKILL.md
│   └── utils/
│       ├── github.ts             # API GitHub wrapper
│       ├── fs.ts                 # File system helpers
│       └── logger.ts             # Output formaté
├── tests/
├── package.json
├── tsconfig.json
└── bunfig.toml
```

### 9.3 Interface Platform (pattern Strategy)

```typescript
interface Platform {
  name: "claude" | "codex";

  /** Détecte si la plateforme est utilisée dans le projet courant */
  detect(projectRoot: string): Promise<boolean>;

  /** Installe les fichiers du skill pour cette plateforme */
  install(skill: SkillPackage, projectRoot: string): Promise<InstalledFiles>;

  /** Désinstalle les fichiers du skill */
  uninstall(skillName: string, projectRoot: string): Promise<void>;

  /** Liste les skills installés pour cette plateforme */
  list(projectRoot: string): Promise<InstalledSkill[]>;

  /** Valide la structure du skill pour cette plateforme */
  validate(skillPath: string): Promise<ValidationResult>;
}
```

---

## 10. Authentification & repos privés

Le CLI supporte les repos GitHub privés dès la v1.

### 10.1 Résolution du token

Ordre de priorité pour trouver un token GitHub :

1. Variable d'environnement `SKILLX_GITHUB_TOKEN`
2. Variable d'environnement `GITHUB_TOKEN`
3. Token `gh auth` (via `gh auth token`)
4. Git credential helper du système

### 10.2 Commande auth

```bash
skillx auth                    # Vérifie l'authentification courante
skillx auth login              # Lance gh auth login si gh est installé
```

### 10.3 Comportement avec repos privés

- L'API tarball GitHub nécessite un token pour les repos privés
- Si aucun token n'est trouvé et que le repo est privé → erreur avec instructions pour s'authentifier
- Le token n'est jamais stocké par skillx (délégué à gh / git credential helper)

---

## 11. Monorepo — plusieurs skills par repo

Un repo GitHub peut contenir plusieurs skills. Le manifest utilise un format étendu :

### 11.1 skillx.json monorepo

```jsonc
{
  "monorepo": true,
  "skills": [
    {
      "name": "blazor-best-practices",
      "version": "1.0.0",
      "description": "Blazor .NET 8/9 development skills",
      "platforms": ["claude", "codex"],
      "claude": {
        "skills": ["packages/blazor/claude/skills/"],
        "agents": ["packages/blazor/claude/agents/"]
      },
      "codex": {
        "instructions": "packages/blazor/codex/AGENTS.md",
        "agents": ["packages/blazor/codex/agents/"],
        "strategy": "section"
      }
    },
    {
      "name": "react-best-practices",
      "version": "1.0.0",
      "description": "React 19 + TypeScript development skills",
      "platforms": ["claude"],
      "claude": {
        "skills": ["packages/react/claude/skills/"]
      }
    }
  ],
  "keywords": ["blazor", "react", "best-practices"],
  "author": "allan",
  "license": "MIT"
}
```

### 11.2 Structure d'un monorepo

```
ai-skills-collection/
├── skillx.json                        # Manifest monorepo
├── README.md
└── packages/
    ├── blazor/
    │   ├── claude/
    │   │   ├── skills/
    │   │   │   └── blazor-best-practices/
    │   │   │       ├── SKILL.md
    │   │   │       └── blazor-component/SKILL.md
    │   │   └── agents/
    │   │       └── blazor.md
    │   └── codex/
    │       ├── AGENTS.md
    │       └── agents/
    │           └── blazor.toml
    └── react/
        └── claude/
            └── skills/
                └── react-best-practices/
                    ├── SKILL.md
                    └── react-component/SKILL.md
```

### 11.3 Installation depuis un monorepo

```bash
# Installer un skill spécifique du monorepo
skillx install user/repo:blazor-best-practices

# Installer tous les skills du monorepo
skillx install user/repo:*

# Lister les skills disponibles dans un monorepo
skillx install user/repo --list
```

---

## 12. Mise à jour de CLAUDE.md

Certains skills nécessitent d'ajouter des entrées dans `CLAUDE.md` (ex: commandes de build, conventions de code). Le manifest peut déclarer du contenu à injecter.

### 12.1 Déclaration dans skillx.json

```jsonc
{
  "name": "blazor-best-practices",
  "claude": {
    "skills": ["claude/skills/"],
    "claudemd": {
      "entries": [
        {
          "section": "## Commands",
          "content": "- `dotnet build` — Build the Blazor project\n- `dotnet test` — Run tests"
        },
        {
          "section": "## Architecture",
          "content": "This project uses Blazor .NET 8 with Interactive Server rendering."
        }
      ]
    }
  }
}
```

### 12.2 Comportement à l'installation

1. Si `CLAUDE.md` n'existe pas → le créer avec le contenu
2. Si `CLAUDE.md` existe :
   - Chercher la section cible (ex: `## Commands`)
   - Si elle existe → ajouter le contenu à la fin de la section, encadré par des balises :
     ```markdown
     ## Commands
     [contenu existant]
     <!-- skillx:blazor-best-practices:start -->
     - `dotnet build` — Build the Blazor project
     - `dotnet test` — Run tests
     <!-- skillx:blazor-best-practices:end -->
     ```
   - Si elle n'existe pas → ajouter la section entière à la fin du fichier
3. Toujours utiliser les balises `<!-- skillx:name:start/end -->` pour permettre la désinstallation propre

### 12.3 Désinstallation

Retire les blocs `<!-- skillx:name:start -->...<!-- skillx:name:end -->` du `CLAUDE.md`. Si une section ne contient plus que des blocs skillx supprimés, la section entière est retirée.

---

## 13. Sécurité

| Risque | Mitigation |
|--------|-----------|
| Script malveillant dans `postinstall` | Afficher le script et demander confirmation avant exécution |
| SKILL.md avec injection de prompt | Hors scope (responsabilité de l'auteur du skill) |
| Token GitHub exposé | Délégué à `gh` / git credential helper, jamais stocké par skillx |
| Écrasement de fichiers existants | Toujours vérifier et demander confirmation si fichier modifié manuellement |
| Repo privé sans auth | Erreur claire avec instructions d'authentification |

---

## 14. Roadmap

### Phase 1 — MVP (v0.1.0)

- [ ] `skillx install user/repo` (Claude Code uniquement)
- [ ] `skillx uninstall <name>`
- [ ] `skillx list`
- [ ] `skillx.json` + `skillx.lock`
- [ ] Support des sub-skills
- [ ] Support repos privés (GitHub token)
- [ ] Validation basique du `skillx.json`

### Phase 2 — Multi-plateforme (v0.2.0)

- [ ] Support Codex (AGENTS.md avec stratégie section + agents TOML)
- [ ] `skillx install --platform`
- [ ] Détection automatique de plateforme
- [ ] `skillx update`
- [ ] `skillx search`
- [ ] Mise à jour de `CLAUDE.md` (sections injectées)

### Phase 3 — Monorepo & Publication (v0.3.0)

- [ ] Support monorepo (`skillx install user/repo:skill-name`)
- [ ] `skillx init` (wizard interactif)
- [ ] `skillx publish --check` (validation/lint)
- [ ] `skillx publish` (guide publication GitHub)
- [ ] Templates de skills

### Phase 4 — Écosystème (v1.0.0)

- [ ] Site web / marketplace (listing des skills)
- [ ] Statistiques de téléchargement
- [ ] Skills vérifiés / certifiés
- [ ] Support de nouvelles plateformes (Cursor, Windsurf, etc.)
- [ ] `skillx install` depuis d'autres sources (npm, URL directe)

---

## 15. Métriques de succès

| Métrique | Cible v1.0 |
|----------|-----------|
| Skills publiés sur GitHub | 50+ |
| Downloads / semaine | 500+ |
| Plateformes supportées | 2 (Claude Code + Codex) |
| Temps d'installation moyen | < 3 secondes |
| Issues ouvertes non résolues | < 10 |

---

## 16. Décisions prises

| Question | Décision |
|----------|----------|
| Agents Codex | Codex supporte les agents dans `.codex/agents/` (TOML). skillx les gère nativement (section 3.2) |
| Repos privés | Supportés dès la v1 via GitHub token (section 10) |
| Monorepo | Supporté via `skillx.json` avec `"monorepo": true` et tableau `skills[]` (section 11) |
| CLAUDE.md | Supporté avec injection par sections délimitées `<!-- skillx:name -->` (section 12) |
| Cache offline | Non supporté — pas de cache local, toujours fetch depuis GitHub |
