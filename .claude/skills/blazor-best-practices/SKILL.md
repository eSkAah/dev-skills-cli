---
name: blazor
description: Blazor .NET 8/9 + C# development — dispatches to specialized sub-skills based on the task
---

# Blazor Development Guide

Use this skill when working on `.razor`, `.razor.cs`, or `.razor.css` files in a Blazor project.

## Choose the Right Sub-Skill

| Task | Skill | When to use |
|------|-------|-------------|
| Creating/editing a component | `/blazor-component` | New component, lifecycle, code-behind, parameters, refs, Razor syntax |
| Structuring a project | `/blazor-architecture` | Render modes, DI, feature folders, project layout, module organization |
| Managing state | `/blazor-state` | Component state, cascading values, Fluxor, state containers, event bus |
| Building a form | `/blazor-form` | EditForm, DataAnnotations, FluentValidation, validation, accessibility |
| Writing tests | `/blazor-testing` | bUnit unit tests, Playwright E2E, mocking services, test patterns |
| Securing the app | `/blazor-security` | Authentication, authorization, CSRF, XSS, CSP, JWT, anti-forgery |
| Optimizing performance | `/blazor-performance` | Virtualization, streaming rendering, AOT, ShouldRender, lazy loading |
| JavaScript interop | `/blazor-jsinterop` | IJSRuntime, IJSObjectReference, module import/disposal, DOM interop |

## Universal Rules (always apply)

- **No business logic in `@code` blocks of page components** — delegate to services.
- **No `object` or untyped parameters** — use strict C# types everywhere.
- **No direct DOM manipulation from C#** — use Blazor's rendering pipeline.
- **No `synchronize: true` in production EF** — use migrations.
- **No secrets in code** — use `IConfiguration` and environment variables.
- **No `MarkupString` with untrusted data** — prevents XSS.
- **No `StateHasChanged()` in loops** — batch updates, call once after.
- **No blocking async** — never use `.Result` or `.Wait()`, always `await`.
- **No skipping `base` calls** — always call base lifecycle methods first.

## When to Use Context7 MCP

The sub-skills contain proven patterns and code examples for common scenarios. **Do NOT call Context7 by default** — it consumes context window.

Use Context7 only when:
- The skill doesn't cover a specific API or feature (e.g., a .NET 10 breaking change)
- You need exact method signatures for a third-party package (MudBlazor, Radzen, Blazored.*)
- The user asks about a very recent feature not yet in the skills

Library IDs for Context7: `/dotnet/aspnetcore` (Blazor), `/bunit-dev/bunit`, `/mrpmorris/fluxor`

## Quick References

- [ASP.NET Core Blazor docs](https://learn.microsoft.com/en-us/aspnet/core/blazor/)
- [Blazor render modes (.NET 8+)](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/render-modes)
- [Blazor component lifecycle](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/lifecycle)
- [Blazor forms and validation](https://learn.microsoft.com/en-us/aspnet/core/blazor/forms/)
- [Blazor dependency injection](https://learn.microsoft.com/en-us/aspnet/core/blazor/fundamentals/dependency-injection)
- [Blazor JS interop](https://learn.microsoft.com/en-us/aspnet/core/blazor/javascript-interoperability/)
- [bUnit testing library](https://bunit.dev/)
- [Fluxor state management](https://github.com/mrpmorris/Fluxor)
