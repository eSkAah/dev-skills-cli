---
name: blazor-analyzer
description: Analyze a Blazor codebase — architecture review, pattern detection, render mode audit, dependency analysis, and Q&A
---

# Blazor Codebase Analyzer

Use this skill to analyze an existing Blazor project. It guides a systematic exploration of the codebase so you can answer questions about its architecture, patterns, and quality.

## Analysis Workflow

When invoked, perform these steps in order:

### 1. Project Discovery

Identify the project type and structure:
- Find `*.csproj` files — check for `<Project Sdk="Microsoft.NET.Sdk.BlazorWebAssembly">` or `Microsoft.NET.Sdk.Web`
- Check `Program.cs` for hosting model (`AddInteractiveServerComponents`, `AddInteractiveWebAssemblyComponents`, `MapRazorComponents`)
- Detect .NET version from `<TargetFramework>` in `.csproj`
- Check for `_Imports.razor` to understand global usings
- Identify if it's Blazor Server, WebAssembly, Hybrid (MAUI), or Web App (.NET 8+ unified)

### 2. Architecture Map

Build a mental model of the project:
- **Entry point**: `App.razor` → `Routes.razor` → Layout → Pages
- **Folder structure**: identify feature-based vs role-based organization
- **Service registration**: scan `Program.cs` and any `ServiceCollectionExtensions` for DI registrations
- **Render modes**: scan for `@rendermode`, `@attribute [StreamRendering]`, global render mode in `App.razor`
- **Shared components**: identify component libraries, shared layouts
- **External dependencies**: check `.csproj` for NuGet packages (MudBlazor, Radzen, Blazored.*, Fluxor, etc.)

### 3. Component Inventory

Catalog the components:
- Glob `**/*.razor` to find all components
- Distinguish **pages** (`@page` directive) from **components** (no route)
- Check for code-behind files (`*.razor.cs`) — note which use inline vs separated code
- Check for CSS isolation files (`*.razor.css`)
- Identify templated/generic components (`@typeparam`)
- Count approximate component complexity (lines, injected services, parameters)

### 4. Pattern Detection

Identify patterns in use:
- **State management**: cascading parameters, scoped services with `OnChange` events, Fluxor stores, `PersistentComponentState`
- **Forms**: EditForm + DataAnnotations vs FluentValidation vs custom
- **Error handling**: `<ErrorBoundary>` usage, try/catch in lifecycle methods
- **JS interop**: `IJSRuntime` / `IJSObjectReference` usage, module pattern vs inline
- **Authentication**: `AuthorizeView`, `[Authorize]` attribute, `AuthenticationStateProvider`
- **Data access**: direct `DbContext`, `IDbContextFactory`, repository pattern, HttpClient
- **Navigation**: `NavigationManager`, `NavLink`, `FocusOnNavigate`

### 5. Quality Audit

Check for common issues:
- **Anti-patterns**: bloated razor files (>200 lines), business logic in components, `StateHasChanged()` in loops, `.Result`/`.Wait()` on async, `MarkupString` with user input
- **DI issues**: scoped `DbContext` without factory, transient `IDisposable` services, missing disposal
- **Performance**: missing virtualization on large lists, no streaming rendering on slow pages, unnecessary re-renders
- **Security**: `MarkupString` with untrusted data, client-only auth checks, tokens in localStorage
- **Testing**: check for `*.Tests` projects, bUnit usage, E2E tests

### 6. Dependency Graph

Map service dependencies:
- Which services depend on which
- Identify potential circular dependencies
- Check for proper lifetime management (Singleton vs Scoped vs Transient)
- Identify services that should use `IDbContextFactory` or `OwningComponentBase`

## Output Format

After analysis, present findings as:

```
## Project Overview
- Type: Blazor [Server/WebAssembly/Web App/Hybrid]
- .NET Version: [version]
- Render Mode: [Static SSR / Interactive Server / Interactive WASM / Interactive Auto / Mixed]
- Components: [count] pages, [count] components
- External Packages: [list key packages]

## Architecture
[Feature-based / Role-based / Flat / Mixed]
[Description of the structure]

## Patterns Detected
- State: [pattern]
- Forms: [pattern]
- Auth: [pattern]
- Data: [pattern]
- JS Interop: [yes/no, pattern]
- Testing: [coverage assessment]

## Issues Found
1. [Severity] [Issue description] — [file:line]
2. ...

## Recommendations
1. [Prioritized improvement suggestion]
2. ...
```

## Answering Questions

After the initial analysis, answer follow-up questions by:
1. Referencing specific files and line numbers
2. Showing relevant code snippets
3. Comparing against best practices from the blazor-best-practices skills
4. Suggesting concrete improvements with code examples

## Common Questions This Skill Handles

- "How is state managed in this project?"
- "What render modes are used and where?"
- "Are there any security concerns?"
- "How are forms handled?"
- "What's the testing coverage like?"
- "Is the DI configuration correct?"
- "What anti-patterns exist?"
- "How would I add a new feature following existing patterns?"
- "What's the component hierarchy?"
- "Are there performance issues?"

## References

- [Blazor best practices](https://learn.microsoft.com/en-us/aspnet/core/blazor/performance)
- [Blazor security](https://learn.microsoft.com/en-us/aspnet/core/blazor/security/)
- [Blazor project structure](https://learn.microsoft.com/en-us/aspnet/core/blazor/project-structure)
