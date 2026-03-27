---
name: blazor-architecture
description: Blazor project architecture — render modes, dependency injection, feature-based structure, project organization
---

# Blazor Architecture Best Practices

Apply these rules when structuring projects, configuring DI, or choosing render modes.

## Feature-Based Structure

```
ProjectName/
├── Components/
│   ├── Layout/
│   │   ├── MainLayout.razor
│   │   └── NavMenu.razor
│   ├── Shared/
│   │   ├── LoadingSpinner.razor
│   │   └── ErrorDisplay.razor
│   └── Pages/
│       └── Home.razor
├── Features/
│   └── [Feature]/
│       ├── Components/
│       │   ├── [Feature]List.razor
│       │   ├── [Feature]List.razor.cs
│       │   ├── [Feature]Detail.razor
│       │   └── [Feature]Form.razor
│       ├── Services/
│       │   ├── I[Feature]Service.cs
│       │   └── [Feature]Service.cs
│       ├── Models/
│       │   ├── [Feature]Dto.cs
│       │   └── [Feature]ViewModel.cs
│       └── [Feature]Page.razor
├── Services/
│   ├── IAuthService.cs
│   └── AuthService.cs
├── wwwroot/
│   ├── css/
│   └── js/
├── Program.cs
└── _Imports.razor
```

## Render Mode Strategy (.NET 8/9)

Choose per-component based on need:

| Mode | Use when | Trade-off |
|------|----------|-----------|
| Static SSR (default) | Content pages, marketing, SEO | No interactivity |
| Interactive Server | Admin panels, real-time data, secure operations | Latency, server load |
| Interactive WebAssembly | Offline, heavy client computation | Large download, code exposed |
| Interactive Auto | Best UX compromise | Complexity, dual hosting |

Rules:
- Default to Static SSR — add interactivity only where needed.
- Set global render mode in `App.razor` only if the entire app is interactive:
  ```razor
  <Routes @rendermode="InteractiveServer" />
  ```
- For mixed apps, apply per-component:
  ```razor
  <Counter @rendermode="InteractiveServer" />
  ```
- Use `[ExcludeFromInteractiveRouting]` (.NET 9) to force static SSR for specific pages.
- Use streaming rendering for pages with slow async data:
  ```csharp
  @attribute [StreamRendering]
  ```

## Dependency Injection

### Lifetimes

| Lifetime | Blazor Server | Blazor WebAssembly |
|----------|---------------|--------------------|
| Singleton | Shared across ALL users/circuits | Per-user (single browser tab) |
| Scoped | Per SignalR circuit (user session) | Same as Singleton |
| Transient | New instance per injection | New instance per injection |

### Rules

- Register services via interfaces for testability:
  ```csharp
  builder.Services.AddScoped<IUserService, UserService>();
  ```
- Use `OwningComponentBase` for component-scoped service lifetimes:
  ```csharp
  @inherits OwningComponentBase

  @code {
      private IUserService UserService => ScopedServices.GetRequiredService<IUserService>();
  }
  ```
- Never inject `DbContext` directly — use `IDbContextFactory<T>`:
  ```csharp
  builder.Services.AddDbContextFactory<AppDbContext>(options =>
      options.UseSqlServer(connectionString));

  // In component or service
  using var context = DbContextFactory.CreateDbContext();
  ```
- Use `@inject` in `.razor` or `[Inject]` in `.razor.cs`:
  ```csharp
  // .razor
  @inject IUserService UserService

  // .razor.cs
  [Inject] private IUserService UserService { get; set; } = default!;
  ```

### Beware: Scoped ≠ Per-Page in Blazor Server

Scoped services live for the entire SignalR circuit (user session), not per-page. A DbContext registered as Scoped will survive across navigations. Use `IDbContextFactory` or `OwningComponentBase` instead.

## Module Organization

- Use `_Imports.razor` at each folder level for namespace imports.
- Group shared services in `ServiceCollectionExtensions`:
  ```csharp
  public static class FeatureServiceExtensions
  {
      public static IServiceCollection AddUserFeature(this IServiceCollection services)
      {
          services.AddScoped<IUserService, UserService>();
          services.AddScoped<IUserRepository, UserRepository>();
          return services;
      }
  }

  // Program.cs
  builder.Services.AddUserFeature();
  ```

## Anti-Patterns

1. **God components** — page components with 500+ lines. Split into feature components + services.
2. **Business logic in components** — delegate to injected services.
3. **Using Scoped DbContext directly** — use `IDbContextFactory` or `OwningComponentBase`.
4. **Making everything Interactive** — default to Static SSR, add interactivity only where needed.
5. **Transient `IDisposable` services** — causes memory leaks in Blazor Server (DI container holds reference for circuit lifetime).
6. **Cross-feature direct references** — use shared services or events for feature-to-feature communication.

## References

- [Blazor project structure](https://learn.microsoft.com/en-us/aspnet/core/blazor/project-structure)
- [Render modes](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/render-modes)
- [Dependency injection](https://learn.microsoft.com/en-us/aspnet/core/blazor/fundamentals/dependency-injection)
- [EF Core with Blazor](https://learn.microsoft.com/en-us/aspnet/core/blazor/blazor-ef-core)
- [Streaming rendering](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/render-modes#streaming-rendering)
