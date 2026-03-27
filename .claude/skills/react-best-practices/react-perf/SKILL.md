---
name: react-perf
description: React performance optimization — memoization, code splitting, virtualization, Suspense, context splitting
---

# React Performance Optimization

Apply these rules when optimizing React components or reviewing performance.

## Memoization — Measure First

- Do NOT add `useMemo`, `useCallback`, or `React.memo` by default.
- Add only when React DevTools Profiler confirms unnecessary re-renders or expensive computation.
- `useCallback` is useless without `React.memo` on the child receiving the callback.
- `React.memo` is useless if props change every render (inline objects, unstable functions).

### When React.memo IS worth it:
  - Granular UI: drawing editors, spreadsheets, data grids
  - Expensive render logic: charts, SVG, canvas
  - Component always receives the same props

### When React.memo is NOT worth it:
  - Props change frequently anyway
  - No perceptible lag
  - Coarse interactions (page-level replacements)

## Code Splitting

- Lazy-load at route level:
  ```typescript
  const Dashboard = lazy(() => import('./pages/Dashboard'));
  ```
- Always pair with `<Suspense fallback={<Skeleton />}>`.
- Nest `<Suspense>` boundaries so sections load independently.
- Wrap `<Suspense>` inside `<ErrorBoundary>` for error + loading states.
- Preload anticipated routes on hover/focus for instant navigation.

## Virtualization

- For lists > 500 items, use `react-window` or `@tanstack/virtual`.
- Never render a full list of 1000+ items in the DOM.

## Props & Renders

- Never pass inline object/array literals to memoized components:
  ```typescript
  // Bad — new reference every render
  <Chart config={{ theme: 'dark' }} />
  // Good — stable reference
  const config = useMemo(() => ({ theme: 'dark' }), []);
  <Chart config={config} />
  ```
- Prefer individual props over wrapper objects when possible.

## Context Optimization

- Split contexts by domain: `AuthContext`, `ThemeContext`, `NotificationContext`.
- One big context forces all consumers to re-render on any change.
- Use `useSyncExternalStore` for external state (stores, browser APIs) instead of context + effects.

## Resource Loading (React 19)

- Use `preload()`, `preinit()`, `preconnect()`, `prefetchDNS()` from `react-dom` for critical resources.
- Render `<link rel="stylesheet">` in components — React 19 manages load order and deduplication.

## References

- [React.memo](https://react.dev/reference/react/memo)
- [useMemo](https://react.dev/reference/react/useMemo)
- [useCallback](https://react.dev/reference/react/useCallback)
- [lazy](https://react.dev/reference/react/lazy)
- [Suspense](https://react.dev/reference/react/Suspense)
- [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [React Profiler](https://react.dev/reference/react/Profiler)
