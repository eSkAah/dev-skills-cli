---
name: react-advanced
description: Advanced React 19 patterns — Server Components, useTransition, useDeferredValue, Error Boundaries, Concurrent React, composition patterns
---

# Advanced React Patterns

Apply these patterns for complex UI challenges, performance-critical features, and React 19 concurrent capabilities.

## Concurrent Rendering

### useTransition — Non-Blocking State Updates

Use when you **control** the state update and want to keep the UI responsive:

```typescript
function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>(products);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);                      // urgent — update input immediately

    startTransition(() => {
      setResults(                         // non-urgent — can be interrupted
        products.filter((p) => p.name.toLowerCase().includes(value.toLowerCase()))
      );
    });
  }

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending && <Spinner />}
      <ProductList items={results} />
    </>
  );
}
```

**Async transitions** — state updates after `await` must wrap in another `startTransition`:
```typescript
startTransition(async () => {
  const data = await fetchResults(query);
  startTransition(() => setResults(data)); // required after await
});
```

### useDeferredValue — Lagging Copy of a Value

Use when you **don't control** the state update (e.g., prop from parent) and want a deferred version:

```typescript
function SearchResults({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <div style={{ opacity: isStale ? 0.5 : 1 }}>
      <Suspense fallback={<Skeleton />}>
        <Results query={deferredQuery} />
      </Suspense>
    </div>
  );
}
```

**When to use which:**

| Situation | Use |
|-----------|-----|
| You own the `setState` call | `useTransition` |
| You receive a prop/value you can't control | `useDeferredValue` |
| Wrapping expensive child rendering | `useDeferredValue` + `memo` |

**Critical**: `useDeferredValue` only helps if the slow component is wrapped in `memo`. Otherwise React re-renders it anyway.

## Error Boundaries

Every app must have error boundaries. React 19 Actions automatically propagate errors to the nearest boundary.

```typescript
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback: ReactNode; }
interface State { hasError: boolean; }

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
```

**Placement strategy:**
```typescript
// Route-level — catches page-wide failures
<ErrorBoundary fallback={<ErrorPage />}>
  <Suspense fallback={<PageSkeleton />}>
    <Route />
  </Suspense>
</ErrorBoundary>

// Feature-level — isolates failures
<ErrorBoundary fallback={<p>Comments failed to load</p>}>
  <Suspense fallback={<CommentsSkeleton />}>
    <Comments />
  </Suspense>
</ErrorBoundary>
```

Always wrap `<Suspense>` inside `<ErrorBoundary>` — handle both loading and error states.

## Composition Patterns

### Compound Components

Components that share implicit state via Context — flexible API, no prop drilling:

```typescript
const MenuContext = createContext<{ isOpen: boolean; toggle: () => void } | null>(null);

function Menu({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <MenuContext.Provider value={{ isOpen, toggle: () => setIsOpen((o) => !o) }}>
      {children}
    </MenuContext.Provider>
  );
}

function MenuTrigger({ children }: { children: ReactNode }) {
  const ctx = useContext(MenuContext)!;
  return <button onClick={ctx.toggle}>{children}</button>;
}

function MenuItems({ children }: { children: ReactNode }) {
  const ctx = useContext(MenuContext)!;
  return ctx.isOpen ? <div role="menu">{children}</div> : null;
}

Menu.Trigger = MenuTrigger;
Menu.Items = MenuItems;

// Usage
<Menu>
  <Menu.Trigger>Open</Menu.Trigger>
  <Menu.Items>
    <a role="menuitem" href="/settings">Settings</a>
  </Menu.Items>
</Menu>
```

### Render Props (when hooks can't work)

Useful for components that need to share rendering logic with variable UI:

```typescript
interface RenderProps<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
}

function DataLoader<T>({
  url,
  children,
}: {
  url: string;
  children: (props: RenderProps<T>) => ReactNode;
}) {
  const { data, isLoading, error } = useQuery<T>({ queryKey: [url], queryFn: () => fetch(url).then(r => r.json()) });
  return <>{children({ data: data as T, isLoading, error: error as Error | null })}</>;
}

// Usage
<DataLoader<User[]> url="/api/users">
  {({ data, isLoading }) => isLoading ? <Spinner /> : <UserList users={data} />}
</DataLoader>
```

**Prefer hooks** over render props when the consumer is always a component. Use render props when the consuming UI varies drastically.

### Slot Pattern (children composition)

```typescript
interface PageLayoutProps {
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}

function PageLayout({ header, sidebar, children }: PageLayoutProps) {
  return (
    <div className="layout">
      <header>{header}</header>
      <aside>{sidebar}</aside>
      <main>{children}</main>
    </div>
  );
}

// Usage — parent controls what goes where
<PageLayout header={<NavBar />} sidebar={<FilterPanel />}>
  <ProductGrid />
</PageLayout>
```

Prefer slots over deep prop drilling for layout composition.

## Server Components (Next.js / RSC)

- Components are **server by default** — no JS shipped to the client.
- Add `'use client'` only for interactivity (state, effects, event handlers, browser APIs).
- Keep client components small and leaf-level — push interactivity to the edges.
- Server components can `await` directly (database, file system, APIs).
- Never import a server component inside a client component — pass as `children` instead:
  ```typescript
  // client-component.tsx
  'use client'
  function Wrapper({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    return <div>{open && children}</div>; // children can be server components
  }
  ```

## Anti-Patterns

1. `useTransition` for everything — only for genuinely expensive/slow updates.
2. `useDeferredValue` without `memo` — no performance benefit.
3. Missing Error Boundaries — unhandled errors crash the entire app.
4. `'use client'` on every component — defeats the purpose of Server Components.
5. HOCs (Higher Order Components) for logic sharing — use hooks instead.
6. Render props when a custom hook would be simpler and more reusable.
7. Deeply nested providers — use Zustand or compound components instead.

## References

- [useTransition](https://react.dev/reference/react/useTransition)
- [useDeferredValue](https://react.dev/reference/react/useDeferredValue)
- [Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Suspense](https://react.dev/reference/react/Suspense)
- [Server Components](https://react.dev/reference/rsc/server-components)
- [React Patterns](https://www.patterns.dev/react)
