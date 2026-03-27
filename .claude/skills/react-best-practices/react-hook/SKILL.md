---
name: react-hook
description: Best practices for writing custom React hooks — rules, patterns, cleanup, dependency arrays, and common pitfalls
---

# React Hook Best Practices

Apply these rules when creating or modifying custom hooks in `.ts`/`.tsx` files.

## Naming & Structure

- Prefix with `use` ONLY if the function calls other hooks internally.
- Pure utility functions must NOT start with `use` — it misleads the linter and developers.
- One hook per file: `useAuth.ts` exports `useAuth`.
- Return typed values — avoid returning loose arrays when the hook returns more than 2 values:
  ```typescript
  // Prefer object return for 3+ values
  function useAuth() {
    return { user, login, logout, isLoading };
  }
  ```

## Dependency Arrays

- All dependencies in `useEffect`, `useMemo`, `useCallback` must be exhaustive — trust the ESLint `react-hooks/exhaustive-deps` rule.
- Never suppress the warning with `// eslint-disable`. Fix the dependency instead.
- If a function is a dependency, stabilize it with `useCallback` or move it inside the effect.

## useEffect Rules

- Always return a cleanup function for subscriptions, timers, and event listeners:
  ```typescript
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then(setData);
    return () => controller.abort();
  }, [url]);
  ```
- Never use `useEffect` for:
  1. **Derived state** — compute during render instead.
  2. **Event handling** — use event handlers directly.
  3. **Data fetching without cancellation** — use a data library or `use()`.
  4. **Syncing state with props** — compute inline or with `useMemo`.

## State Patterns

- Use discriminated unions for async state:
  ```typescript
  type State<T> =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: Error };
  ```
- Use `useReducer` over multiple `useState` when state transitions are interdependent.
- Never mutate state — always create new references (`{ ...obj }`, `[...arr]`).

## Common Anti-Patterns

1. **Stale closures**: missing dependencies cause effects to capture outdated values.
2. **Infinite loops**: setting state inside an effect that depends on that state.
3. **Race conditions**: multiple async effects without cleanup/cancellation.
4. **Over-abstraction**: don't create a hook for a one-off piece of logic.

## References

- [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [useEffect](https://react.dev/reference/react/useEffect)
- [useReducer](https://react.dev/reference/react/useReducer)
- [Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
