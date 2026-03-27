---
name: react-testing
description: React testing patterns with Vitest + React Testing Library — what to test, query priority, mocking, hook testing, async patterns
---

# React Testing Best Practices

Apply these rules when writing or modifying test files (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`).

## Philosophy

Test **behavior**, not implementation. "The more your tests resemble the way your software is used, the more confidence they can give you."

## Query Priority (strict order)

1. **Preferred** — mimics user experience:
   - `getByRole('button', { name: /submit/i })`
   - `getByLabelText(/email/i)`
   - `getByPlaceholderText(/search/i)`
   - `getByText(/welcome/i)`
2. **Acceptable** — semantic queries:
   - `getByAltText()`, `getByTitle()`
3. **Last resort only**:
   - `getByTestId()` — only when no accessible query works

Never use `container.querySelector()`.

## User Interaction

Always use `userEvent` over `fireEvent` — it simulates real user behavior:

```typescript
import userEvent from '@testing-library/user-event';

test('submits the form', async () => {
  const user = userEvent.setup();
  render(<LoginForm />);

  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(await screen.findByText(/success/i)).toBeInTheDocument();
});
```

## Async Patterns

- Use `findBy*` (returns promise) for elements appearing after async operations.
- Use `waitFor` only when `findBy*` doesn't fit:
  ```typescript
  await waitFor(() => {
    expect(screen.getByText(/loaded/i)).toBeInTheDocument();
  });
  ```
- Use `queryBy*` to assert elements are NOT present: `expect(screen.queryByText(/error/i)).not.toBeInTheDocument()`.

## Testing Custom Hooks

Use `renderHook` from `@testing-library/react` (NOT the deprecated `@testing-library/react-hooks`):

```typescript
import { renderHook, act } from '@testing-library/react';

test('useCounter increments', () => {
  const { result } = renderHook(() => useCounter());

  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(1);
});
```

## Mocking — Only at the Edges

- Mock **external services** (API, localStorage, timers), NOT internal components or hooks.
- Use **MSW** (Mock Service Worker) for API mocking:
  ```typescript
  import { http, HttpResponse } from 'msw';
  import { setupServer } from 'msw/node';

  const server = setupServer(
    http.get('/api/users', () =>
      HttpResponse.json([{ id: 1, name: 'John' }])
    )
  );

  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  ```
- Use `vi.fn()` / `vi.mock()` / `vi.spyOn()` (Vitest, not Jest).
- Always `vi.clearAllMocks()` in `beforeEach` to prevent leaking state.

## Vitest Setup

```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});

// vitest.setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

## Accessibility Testing in Tests

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('has no a11y violations', async () => {
  const { container } = render(<MyComponent />);
  expect(await axe(container)).toHaveNoViolations();
});
```

## What to Test / What NOT to Test

**Test:**
- User-visible behavior (clicks, submissions, navigation)
- Conditional rendering based on state/props
- Error states and edge cases
- Custom hook return values and state transitions
- Accessibility (ARIA attributes, keyboard nav, axe audits)

**Don't test:**
- Implementation details (internal state, private methods)
- Third-party library internals
- CSS styling (use visual regression tools instead)
- One-to-one component snapshots (hide real regressions)

## Anti-Patterns

1. Mocking internal components or `useState` — breaks real behavior.
2. Testing that a mock was called without asserting visible outcome.
3. Using `act()` manually when `userEvent` handles it automatically.
4. Snapshot overuse — snapshots break on every UI change and hide real issues.
5. Not cleaning up mocks between tests — leads to flaky tests.

## References

- [React Testing Library docs](https://testing-library.com/docs/react-testing-library/intro)
- [Query priority guide](https://testing-library.com/docs/queries/about#priority)
- [userEvent docs](https://testing-library.com/docs/user-event/intro)
- [MSW docs](https://mswjs.io/docs/)
- [Vitest docs](https://vitest.dev/guide/)
- [jest-axe](https://github.com/nickcolley/jest-axe)
