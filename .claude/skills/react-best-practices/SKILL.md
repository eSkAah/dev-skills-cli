---
name: react
description: React 19 + TypeScript development — dispatches to specialized sub-skills based on the task
---

# React Development Guide

Use this skill when working on `.ts` or `.tsx` files. It provides an overview and directs you to the right specialized skill.

## Choose the Right Sub-Skill

| Task | Skill | When to use |
|------|-------|-------------|
| Creating/editing a component | `/react-component` | New component, props design, typing, refs, component structure |
| Writing a custom hook | `/react-hook` | Custom hooks, useEffect, useReducer, state patterns, dependency arrays |
| Optimizing performance | `/react-perf` | Memoization, code splitting, virtualization, Suspense, context optimization |
| Building a form | `/react-form` | useActionState, useOptimistic, useFormStatus, validation, accessibility |
| Writing tests | `/react-testing` | Vitest + React Testing Library, queries, mocking (MSW), hook testing |
| Structuring a feature | `/react-architecture` | Feature folders, Zustand, TanStack Query, separation of concerns |
| Accessibility review | `/react-a11y` | Semantic HTML, ARIA, keyboard nav, focus management, screen readers |
| Advanced patterns | `/react-advanced` | useTransition, useDeferredValue, Error Boundaries, Server Components, composition |

## Universal Rules (always apply)

- **No `any`** — use `unknown` with type guards or proper types.
- **No array index as key** — use stable unique IDs.
- **No state mutation** — always create new references.
- **No suppressing ESLint hooks warnings** — fix the dependency instead.
- **No `useEffect` for derived state** — compute during render.
- **No `forwardRef`** — React 19 supports ref as a regular prop.
- **No `<div onClick>`** — use `<button>` for actions, `<a>` for navigation.
- **No missing labels** — every `<input>` needs a `<label>`.
- **No outline removal** — never remove focus indicators without replacement.

## Quick References

- [React 19 docs](https://react.dev)
- [React 19 Release Notes](https://react.dev/blog/2024/12/05/react-19)
- [TypeScript with React](https://react.dev/learn/typescript)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Zustand docs](https://zustand.docs.pmnd.rs/)
- [TanStack Query docs](https://tanstack.com/query/latest)
