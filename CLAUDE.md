# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## skillx — Development Workflow

**IMPORTANT**: Before starting any development work on the skillx CLI project, ALWAYS read `WORKFLOW.md` first. It contains the task breakdown with current progress status. Update the task status in `WORKFLOW.md` as you work:
- `[ ]` → `[~]` when starting a task
- `[~]` → `[x]` when completing a task
- Add a session entry in the "Journal de session" table at the bottom

The PRD is in `PRD.md`. The skillx CLI source lives in `packages/skillx/` (separate from the existing Vite+React app).

To run the CLI during development: `cd packages/skillx && bun run src/index.ts`

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Type-check with `tsc -b` then build for production
- `npm run lint` — Run ESLint (flat config, TS/TSX files only)
- `npm run preview` — Preview the production build locally

## Architecture

Vite + React 19 + TypeScript project using ES modules (`"type": "module"`).

- **Entry point**: `index.html` → `src/main.tsx` → `src/App.tsx`
- **Static assets**: `public/` (served as-is) and `src/assets/` (processed by Vite)
- **Build output**: `dist/`

## TypeScript Config

Split into three files — `tsconfig.json` is a project reference root:
- `tsconfig.app.json` — app source (src/)
- `tsconfig.node.json` — Node-side config files (vite.config.ts, etc.)

## Linting

ESLint 9 flat config (`eslint.config.js`) with:
- `typescript-eslint` for TS rules
- `eslint-plugin-react-hooks` for hooks rules
- `eslint-plugin-react-refresh` for fast refresh compatibility
