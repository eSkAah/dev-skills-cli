---
name: react-component
description: Best practices for creating React 19 components with TypeScript — typing, structure, props, refs, and React 19 APIs
---

# React Component Best Practices

Apply these rules when creating or modifying React components in `.tsx` files.

## Structure

- One exported component per file. Private helpers are fine in the same file.
- Use function declarations, not arrow functions, for components:
  ```typescript
  function UserCard({ name }: UserCardProps) { ... }
  ```
- Name the file after the component: `UserCard.tsx` exports `UserCard`.

## TypeScript Typing

- Define props with `interface` (not `type`) for extendability:
  ```typescript
  interface UserCardProps {
    name: string;
    role?: 'admin' | 'user';
    children: React.ReactNode;
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  }
  ```
- Never use `any`. Use `unknown` with type guards or proper types.
- Use generics for reusable components:
  ```typescript
  interface ListProps<T> {
    items: T[];
    renderItem: (item: T) => React.ReactNode;
    keyExtractor: (item: T) => string;
  }
  function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) { ... }
  ```
- Type all event handlers explicitly: `React.ChangeEvent<HTMLInputElement>`, `React.FormEvent<HTMLFormElement>`, etc.

## Refs (React 19)

- Pass `ref` as a regular prop — no `forwardRef` needed:
  ```typescript
  function MyInput({ ref, ...props }: { ref?: React.Ref<HTMLInputElement> } & InputProps) {
    return <input ref={ref} {...props} />;
  }
  ```
- Use cleanup functions in callback refs:
  ```typescript
  <div ref={(node) => {
    // setup
    return () => { /* cleanup */ };
  }} />
  ```

## React 19 APIs

- Render `<title>`, `<meta>`, `<link>` directly in components — React 19 hoists them to `<head>`.
- Use `use()` to read promises and context conditionally (after early returns).
- Prefer resource preloading APIs: `preload()`, `preinit()`, `preconnect()`, `prefetchDNS()` from `react-dom`.

## Anti-Patterns

- Never store derived values in state — compute during render or with `useMemo`.
- Never use array index as `key` — use stable unique IDs.
- Avoid prop drilling beyond 2 levels — use Context or composition.

## References

- [React Component API](https://react.dev/reference/react/Component)
- [React 19 Release Notes](https://react.dev/blog/2024/12/05/react-19)
- [TypeScript with React](https://react.dev/learn/typescript)
- [Passing Props](https://react.dev/learn/passing-props-to-a-component)
- [Composition vs Inheritance](https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children)
