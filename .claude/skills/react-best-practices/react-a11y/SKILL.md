---
name: react-a11y
description: React accessibility — semantic HTML, ARIA patterns, keyboard navigation, focus management, screen readers, contrast
---

# React Accessibility (a11y) Best Practices

Apply these rules to every component. Accessibility is not optional — WCAG compliance is legally mandatory in the EU since June 2025.

## Rule #1: Semantic HTML First

Use native elements. They have built-in keyboard support, focus management, and screen reader announcements:

```typescript
// Good — built-in accessibility
<button onClick={handleClose}>Close</button>
<nav><ul><li><a href="/about">About</a></li></ul></nav>
<main>Content</main>
<form><label htmlFor="email">Email</label><input id="email" type="email" /></form>

// Bad — requires manual ARIA, keyboard handling, focus management
<div onClick={handleClose}>Close</div>
<div className="nav">...</div>
```

Use the right element: `<button>` for actions, `<a>` for navigation, `<input>` for data entry, `<table>` for tabular data, `<dialog>` for modals.

## ARIA — Only When Native HTML Can't

### Labels

```typescript
// Visible label (preferred)
<label htmlFor="search">Search</label>
<input id="search" type="text" />

// No visible label possible — use aria-label
<button aria-label="Close menu"><XIcon /></button>

// Complex labeling — use aria-labelledby
<h2 id="dialog-title">Confirm Delete</h2>
<div role="dialog" aria-labelledby="dialog-title" aria-modal="true">...</div>

// Additional description
<input id="pwd" type="password" aria-describedby="pwd-hint" />
<span id="pwd-hint">Must be at least 8 characters</span>
```

### States

```typescript
<button aria-pressed={isActive}>Toggle</button>
<button aria-expanded={isOpen} aria-controls="menu">Menu</button>
<div id="menu" role="menu" hidden={!isOpen}>...</div>
<input aria-invalid={hasError} aria-describedby={hasError ? 'error-msg' : undefined} />
```

### Live Regions (dynamic content)

```typescript
// Polite — announces when screen reader finishes current speech
<div aria-live="polite" aria-atomic="true">{notification}</div>

// Assertive — interrupts (use sparingly: critical errors only)
<div role="alert">{errorMessage}</div>
```

### Hiding Decorative Content

```typescript
<span aria-hidden="true">→</span>   {/* decorative arrow */}
<img src="divider.svg" alt="" />      {/* decorative image — empty alt */}
```

## Keyboard Navigation

### Every Interactive Element Must Be Keyboard Accessible

- Native `<button>`, `<a>`, `<input>`, `<select>` — already keyboard accessible.
- Custom interactive elements need `tabIndex={0}`, `onKeyDown`, and `role`:
  ```typescript
  function CustomButton({ onPress, children }: CustomButtonProps) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onPress}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPress();
          }
        }}
      >
        {children}
      </div>
    );
  }
  ```

### Tab Order

- Never use `tabIndex > 0` — it breaks natural DOM tab order.
- Use `tabIndex={0}` to add to tab order, `tabIndex={-1}` to make focusable but skip tab order.

### Skip Link

Every app must have a skip link as the first focusable element:

```typescript
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

## Focus Management

### Modals / Dialogs

- Focus the first interactive element (or close button) on open.
- Trap focus inside the modal — Tab/Shift+Tab must cycle within it.
- Return focus to the trigger element on close.

```typescript
function Modal({ isOpen, onClose, triggerRef }: ModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
    else triggerRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">Title</h2>
      <button ref={closeRef} onClick={onClose}>Close</button>
    </div>
  );
}
```

### Route Changes (SPA)

Announce page changes to screen readers:

```typescript
function RouteAnnouncer({ title }: { title: string }) {
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      Navigated to {title}
    </div>
  );
}
```

## Forms

- Every `<input>` must have a `<label>` with matching `htmlFor`/`id`.
- Group related inputs with `<fieldset>` + `<legend>`.
- Error messages: use `role="alert"` or `aria-live="polite"` + `aria-describedby` linking to the field.
- Loading state: `aria-busy={isLoading}` + `disabled`.
- Required fields: `required` attribute (native) or `aria-required="true"`.

## Visual

- Focus indicators: never remove `outline` without a visible replacement. Use `focus-visible`:
  ```css
  :focus-visible {
    outline: 3px solid #4A90E2;
    outline-offset: 2px;
  }
  ```
- Color contrast: minimum 4.5:1 for text, 3:1 for large text and UI elements (WCAG AA).
- Never convey information with color alone — add icons, text, or patterns.

## Screen Reader Only Utility

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

## Anti-Patterns

1. `<div onClick>` instead of `<button>` — loses keyboard, focus, and screen reader support.
2. `aria-hidden="true"` on interactive elements — removes them from assistive tech.
3. Missing `alt` on informative images (decorative images need `alt=""`).
4. `outline: none` without replacement — breaks keyboard navigation.
5. `tabIndex > 0` — messes up natural tab order.
6. Ignoring focus management on route changes and modal open/close.
7. Using `aria-label` when a visible `<label>` would work — visible labels help everyone.

## References

- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [React Accessibility docs](https://react.dev/reference/react-dom/components#form-components)
- [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)
- [React Aria (Adobe)](https://react-spectrum.adobe.com/react-aria/)
- [Inclusive Components — Heydon Pickering](https://inclusive-components.design/)
