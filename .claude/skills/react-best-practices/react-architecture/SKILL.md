---
name: react-architecture
description: React project architecture — feature-based structure, state management (Zustand/Context), data fetching (TanStack Query), separation of concerns
---

# React Architecture Best Practices

Apply these rules when creating new features, organizing files, or choosing state/data patterns.

## Feature-Based Directory Structure

```
src/
├── app/                    # Entry point, providers, router
├── shared/                 # Reusable, feature-agnostic code
│   ├── components/         # Generic UI (Button, Modal, Input)
│   ├── hooks/              # Shared hooks (useDebounce, useMediaQuery)
│   ├── utils/              # Pure utilities
│   └── types/              # Shared TypeScript types
└── features/               # Feature-specific code
    └── [feature-name]/
        ├── components/     # Feature UI
        ├── hooks/          # Feature hooks
        ├── services/       # Business logic + API calls
        ├── store/          # Feature state (Zustand slice)
        ├── types/          # Feature types
        └── index.ts        # Public API (barrel export)
```

**Rules:**
- A feature folder groups everything related to one domain (products, auth, checkout).
- `features/` imports from `shared/` — never the reverse.
- Features never import directly from other features — use `shared/` or lift to `app/`.
- Maximum 3 levels of nesting. Deeper = refactoring pain.
- Barrel exports (`index.ts`) define the public API of each feature.

## State Management — Decision Matrix

| Need | Solution |
|------|----------|
| Theme, locale, auth token (rarely changes) | React Context |
| UI state shared across 2-3 components | Lift state up + props |
| Global client state (cart, filters, user preferences) | **Zustand** |
| Server/async state (API data, caching, sync) | **TanStack Query** |
| Complex state with many interdependent transitions | `useReducer` or Zustand |

### Zustand — Client State

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((s) => ({ items: [...s.items, item] })),
      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'cart-storage' }
  )
);
```

- No Provider needed — use the hook directly.
- Select only what you need to avoid unnecessary re-renders:
  ```typescript
  const count = useCartStore((s) => s.items.length);
  ```
- Use `persist` middleware for localStorage/sessionStorage.

### TanStack Query — Server State

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Read
function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then((r) => r.json()),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Write + cache invalidation
function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NewProduct) =>
      fetch('/api/products', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
```

- `queryKey` = cache key. Structure hierarchically: `['products']`, `['products', id]`, `['products', { filter }]`.
- Use `staleTime` to control cache freshness.
- `invalidateQueries` on mutation success to refetch stale data.
- Use `prefetchQuery` for anticipated navigation.

### Never Mix Concerns

- Zustand = **what the client decided** (UI state, user preferences, cart).
- TanStack Query = **what the server said** (entities, lists, remote data).
- Don't cache server data in Zustand. Don't use TanStack Query for local-only state.

## Separation of Concerns

### Services Layer

```
features/products/services/
├── productApi.ts          # API calls only (fetch, axios)
└── productService.ts      # Business logic, data transformation
```

- **API layer**: raw HTTP calls, no business logic.
- **Service layer**: transforms, validates, orchestrates.
- Components call services, never the API layer directly.

### Hooks as Glue

Feature hooks connect services to components:
```typescript
// features/products/hooks/useProducts.ts
export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => productApi.getProducts(filters),
    select: (data) => productService.transformForDisplay(data),
  });
}
```

Components stay thin — render UI, delegate logic to hooks/services.

## Anti-Patterns

1. **God component**: one component with 500+ lines doing everything — split by concern.
2. **Cross-feature imports**: `features/checkout` importing from `features/products` internals — lift shared code to `shared/`.
3. **Provider hell**: 10+ nested Context providers — use Zustand instead.
4. **Fetching in components**: `useEffect` + `fetch` + manual loading/error state — use TanStack Query.
5. **Prop drilling > 2 levels**: pass through intermediaries — use Context or Zustand.
6. **Barrel re-exports of everything**: only export the public API.

## References

- [Zustand docs](https://zustand.docs.pmnd.rs/)
- [TanStack Query docs](https://tanstack.com/query/latest)
- [Bulletproof React architecture](https://github.com/alan2207/bulletproof-react)
- [React folder structure — Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/)
