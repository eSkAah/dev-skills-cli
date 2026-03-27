---
name: blazor-performance
description: Blazor performance — virtualization, streaming rendering, AOT compilation, ShouldRender, lazy loading
---

# Blazor Performance Best Practices

Apply these rules when optimizing Blazor application performance.

## Measure First

Never optimize without profiling. Use browser DevTools, .NET diagnostics, or Application Insights to identify actual bottlenecks.

## Virtualization — Large Lists

Render only visible items with the `Virtualize` component:
```razor
<Virtualize Items="@_users" Context="user" OverscanCount="5">
    <ItemContent>
        <UserCard User="@user" />
    </ItemContent>
    <Placeholder>
        <div class="skeleton-card"></div>
    </Placeholder>
</Virtualize>
```

For server-side data loading (pagination):
```razor
<Virtualize ItemsProvider="LoadUsers" Context="user" OverscanCount="5">
    <ItemContent>
        <UserRow User="@user" />
    </ItemContent>
</Virtualize>

@code {
    private async ValueTask<ItemsProviderResult<UserDto>> LoadUsers(
        ItemsProviderRequest request)
    {
        var result = await UserService.GetPageAsync(request.StartIndex, request.Count);
        return new ItemsProviderResult<UserDto>(result.Items, result.TotalCount);
    }
}
```

Virtualization can reduce memory from ~1.4 GB to ~100 MB for large datasets.

## Streaming Rendering

Show placeholder content while async data loads:
```csharp
@page "/reports"
@attribute [StreamRendering]

@if (_reports is null)
{
    <LoadingSpinner />
}
else
{
    @foreach (var report in _reports)
    {
        <ReportCard Report="@report" />
    }
}

@code {
    private List<ReportDto>? _reports;

    protected override async Task OnInitializedAsync()
    {
        _reports = await ReportService.GetAllAsync(); // Slow query
    }
}
```

Use for Static SSR and prerendered components with slow async initialization.

## ShouldRender — Prevent Unnecessary Re-Renders

```csharp
private string _previousName = string.Empty;

protected override bool ShouldRender()
{
    if (Name == _previousName) return false;
    _previousName = Name;
    return true;
}
```

Rules:
- Override `ShouldRender` for components that re-render frequently but rarely change.
- Don't use for all components — adds complexity with minimal gain for simple components.
- After the first render, `ShouldRender` is checked before every subsequent render.

## Reduce Render Tree Size

- Avoid deep nesting — flatten component hierarchy where possible.
- Use `@key` to help Blazor diff efficiently:
  ```razor
  @foreach (var user in _users)
  {
      <UserCard @key="user.Id" User="@user" />
  }
  ```
- Split large components — a re-render of a parent re-renders all children.

## Avoid Unnecessary StateHasChanged Calls

```csharp
// BAD — calls StateHasChanged in a loop
foreach (var item in items)
{
    _items.Add(item);
    StateHasChanged(); // Re-renders on each iteration!
}

// GOOD — batch updates, single render
foreach (var item in items)
{
    _items.Add(item);
}
StateHasChanged(); // Single render after all changes
```

EventCallback and lifecycle methods already trigger re-renders — don't call `StateHasChanged` redundantly.

## Lazy Loading Assemblies (WebAssembly)

Load assemblies on demand to reduce initial download:
```csharp
// App.razor
<Router AppAssembly="typeof(App).Assembly"
        OnNavigateAsync="OnNavigateAsync"
        AdditionalAssemblies="@_lazyAssemblies">
    ...
</Router>

@code {
    private List<Assembly> _lazyAssemblies = new();

    private async Task OnNavigateAsync(NavigationContext context)
    {
        if (context.Path == "admin")
        {
            var assemblies = await LazyAssemblyLoader
                .LoadAssembliesAsync(new[] { "AdminModule.wasm" });
            _lazyAssemblies.AddRange(assemblies);
        }
    }
}
```

## AOT Compilation (WebAssembly)

Enable for CPU-intensive apps — larger download but faster runtime:
```xml
<!-- .csproj -->
<PropertyGroup>
    <RunAOTCompilation>true</RunAOTCompilation>
</PropertyGroup>
```

Trade-off: ~2-3x larger download, but significantly faster execution for computation-heavy operations.

## Minimize JS Interop in Hot Paths

- Batch JS calls — each interop call has SignalR overhead in Blazor Server.
- Throttle/debounce in JavaScript, not in C#:
  ```javascript
  // js/helpers.js
  export function onScrollThrottled(dotNetRef, throttleMs) {
      let timeout;
      window.addEventListener('scroll', () => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
              dotNetRef.invokeMethodAsync('OnScroll', window.scrollY);
          }, throttleMs);
      });
  }
  ```
- Avoid calling JS on every `mousemove`, `scroll`, or `resize` event.

## HTTP & Data Optimization

- Use `HttpClient` with `IHttpClientFactory` — never create `HttpClient` manually.
- Implement pagination — never load unbounded datasets.
- Use `CancellationToken` on async operations to cancel when component disposes.
- Cache API responses where appropriate:
  ```csharp
  builder.Services.AddMemoryCache();

  // In service
  public async Task<List<CategoryDto>> GetCategoriesAsync()
  {
      return await _cache.GetOrCreateAsync("categories", async entry =>
      {
          entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
          return await _httpClient.GetFromJsonAsync<List<CategoryDto>>("/api/categories");
      }) ?? [];
  }
  ```

## Anti-Patterns

1. **Rendering thousands of items without virtualization** — use `<Virtualize>`.
2. **`StateHasChanged()` inside loops** — batch updates, call once.
3. **Blocking async with `.Result` or `.Wait()`** — deadlocks in Blazor Server.
4. **Premature `ShouldRender` optimization** — measure first, optimize measured bottlenecks.
5. **Loading all assemblies upfront in WASM** — use lazy loading for large modules.
6. **High-frequency JS interop calls** — throttle/debounce in JavaScript.
7. **Unbounded data loading** — always paginate.

## References

- [Blazor performance best practices](https://learn.microsoft.com/en-us/aspnet/core/blazor/performance)
- [Virtualize component](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/virtualize)
- [Streaming rendering](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/render-modes#streaming-rendering)
- [Lazy loading assemblies](https://learn.microsoft.com/en-us/aspnet/core/blazor/webassembly-lazy-load-assemblies)
- [AOT compilation](https://learn.microsoft.com/en-us/aspnet/core/blazor/tooling/webassembly#ahead-of-time-aot-compilation)
