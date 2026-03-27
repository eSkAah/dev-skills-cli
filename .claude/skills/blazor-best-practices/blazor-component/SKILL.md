---
name: blazor-component
description: Best practices for creating Blazor components — lifecycle, code-behind, parameters, Razor syntax, render modes
---

# Blazor Component Best Practices

Apply these rules when creating or modifying Blazor components in `.razor` and `.razor.cs` files.

## Structure

- One routable component per file. Private child components are fine in the same file for small helpers.
- Name the file after the component: `UserCard.razor` renders as `<UserCard>`.
- Use code-behind (`UserCard.razor.cs`) for complex components — keep `.razor` for markup only:
  ```csharp
  // UserCard.razor.cs
  public partial class UserCard : ComponentBase
  {
      [Parameter] public string Name { get; set; } = string.Empty;
      [Parameter] public EventCallback<string> OnNameChanged { get; set; }
  }
  ```
- Keep simple components inline with `@code { }` blocks.

## Parameters

- Use `[Parameter]` for parent-to-child communication:
  ```csharp
  [Parameter] public string Title { get; set; } = string.Empty;
  [Parameter] public RenderFragment? ChildContent { get; set; }
  [Parameter] public EventCallback<MouseEventArgs> OnClick { get; set; }
  ```
- Use `[EditorRequired]` for mandatory parameters:
  ```csharp
  [Parameter, EditorRequired] public string UserId { get; set; } = default!;
  ```
- Use `[CascadingParameter]` sparingly — only for app-level concerns (theme, auth, culture).
- Use `[SupplyParameterFromQuery]` for query string binding on routable components.
- Capture unmatched attributes with `[Parameter(CaptureUnmatchedValues = true)]`:
  ```csharp
  [Parameter(CaptureUnmatchedValues = true)]
  public Dictionary<string, object>? AdditionalAttributes { get; set; }
  ```

## Lifecycle Methods

Execution order on first render:
1. `SetParametersAsync` → 2. `OnInitialized{Async}` → 3. `OnParametersSet{Async}` → 4. `OnAfterRender{Async}`

Rules:
- Always call the `base` method first:
  ```csharp
  protected override async Task OnInitializedAsync()
  {
      await base.OnInitializedAsync();
      _users = await UserService.GetAllAsync();
  }
  ```
- Use `OnInitialized{Async}` for one-time setup (data loading, subscriptions).
- Use `OnParametersSet{Async}` for logic that depends on parameter changes.
- Use `OnAfterRender{Async}` for JS interop (DOM not available before this).
- Check `firstRender` in `OnAfterRenderAsync` to avoid re-initializing JS modules:
  ```csharp
  protected override async Task OnAfterRenderAsync(bool firstRender)
  {
      if (firstRender)
      {
          _module = await JS.InvokeAsync<IJSObjectReference>("import", "./js/chart.js");
      }
  }
  ```
- Implement `IAsyncDisposable` for cleanup (timers, event subscriptions, JS modules).

## RenderFragment and Templated Components

```csharp
// Templated list component
@typeparam TItem

@foreach (var item in Items)
{
    @ItemTemplate(item)
}

@code {
    [Parameter, EditorRequired] public IReadOnlyList<TItem> Items { get; set; } = default!;
    [Parameter, EditorRequired] public RenderFragment<TItem> ItemTemplate { get; set; } = default!;
}

// Usage
<GenericList Items="users" Context="user">
    <ItemTemplate>
        <p>@user.Name</p>
    </ItemTemplate>
</GenericList>
```

## Render Modes (.NET 8+)

Apply per-component where needed:
```csharp
@rendermode InteractiveServer       // Server-side via SignalR
@rendermode InteractiveWebAssembly  // Client-side WASM
@rendermode InteractiveAuto         // Auto: starts server, switches to WASM
```
- Default is Static SSR (no interactivity).
- Only add interactivity where needed — keep content pages static.
- Interactive components cannot receive non-serializable parameters from static parents.

## CSS Isolation

- Create `UserCard.razor.css` alongside `UserCard.razor`.
- Component must have a single root element for scoped styles to apply.
- Use `::deep` to style child component content (use sparingly):
  ```css
  ::deep h3 {
      color: var(--primary);
  }
  ```

## Anti-Patterns

1. **Bloated `.razor` files** — extract logic to `.razor.cs` or services.
2. **Calling `StateHasChanged()` inside lifecycle methods** — they trigger re-render automatically.
3. **Using `OnInitialized` for parameter-dependent logic** — use `OnParametersSet` instead.
4. **Storing derived values in fields** — compute them in the render or with properties.
5. **Deep parameter drilling** — use cascading values or DI services.
6. **Mutating `[Parameter]` properties** — parameters are owned by the parent.

## References

- [ASP.NET Core Razor components](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/)
- [Component lifecycle](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/lifecycle)
- [Render modes](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/render-modes)
- [CSS isolation](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/css-isolation)
- [Templated components](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/templated-components)
