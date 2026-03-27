---
name: react-form
description: React 19 form patterns — useActionState, useOptimistic, useFormStatus, validation, and accessible forms
---

# React Form Best Practices

Apply these rules when creating or modifying forms in `.tsx` files.

## React 19 Form APIs — Use These First

### useActionState (replaces manual useState + handleSubmit)

```typescript
const [state, submitAction, isPending] = useActionState(
  async (prevState, formData) => {
    const error = await saveUser(formData.get("name") as string);
    return error ? { error } : { success: true };
  },
  { error: null }
);

return (
  <form action={submitAction}>
    <input type="text" name="name" required />
    <button type="submit" disabled={isPending}>Save</button>
    {state.error && <p role="alert">{state.error}</p>}
  </form>
);
```
- Manages pending state, errors, and form reset automatically.
- Replaces `useState` + `handleSubmit` + `setLoading` + `setError` boilerplate.

### useOptimistic (instant feedback)

```typescript
const [optimisticItems, addOptimistic] = useOptimistic(
  items,
  (current, newItem: Item) => [...current, { ...newItem, pending: true }]
);

async function handleAdd(formData: FormData) {
  const newItem = { name: formData.get("name") as string };
  addOptimistic(newItem);       // show immediately
  await createItem(newItem);    // persist to server
}
```
- Show the result before the server confirms.
- Reverts automatically on error.

### useFormStatus (child component access)

```typescript
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>
    {pending ? 'Saving...' : 'Save'}
  </button>;
}
```
- Must be used in a child component of `<form>` — not in the same component that renders the form.
- Eliminates prop-drilling of loading state.

## Validation

- Use native HTML validation attributes first: `required`, `pattern`, `min`, `max`, `type="email"`.
- Add server-side validation in the action function — never trust client-only validation.
- Display errors next to the relevant field, not in a banner.
- Type validation state explicitly:
  ```typescript
  interface FormState {
    errors: Partial<Record<keyof FormData, string>>;
    success: boolean;
  }
  ```

## Accessibility

- Every `<input>` must have a `<label>` with matching `htmlFor`/`id`.
- Use `role="alert"` or `aria-live="polite"` on error messages.
- Disable submit button while `isPending` to prevent double submission.
- Use `aria-invalid="true"` on fields with errors.

## Anti-Patterns

1. Manual `useState` for form fields when `useActionState` + FormData works.
2. Uncontrolled-to-controlled switches — pick one pattern per field.
3. `e.preventDefault()` + manual fetch when `<form action={...}>` handles it natively.
4. Missing error cleanup — clear field errors when user starts typing again.

## References

- [useActionState](https://react.dev/reference/react/useActionState)
- [useOptimistic](https://react.dev/reference/react/useOptimistic)
- [useFormStatus](https://react.dev/reference/react-dom/hooks/useFormStatus)
- [React 19 Form Actions](https://react.dev/blog/2024/12/05/react-19#actions)
- [MDN: Client-Side Form Validation](https://developer.mozilla.org/en-US/docs/Learn/Forms/Form_validation)
