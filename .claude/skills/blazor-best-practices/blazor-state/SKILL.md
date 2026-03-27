---
name: blazor-state
description: Blazor state management — component state, cascading values, Fluxor, state containers, event-driven patterns
---

# Blazor State Management Best Practices

Apply these rules when managing state across components.

## State Complexity Ladder

Choose the simplest approach that fits:

| Complexity | Solution | When to use |
|------------|----------|-------------|
| Low | Component fields + `[Parameter]` | Single component, parent-child |
| Medium | Cascading values | App-level concerns (theme, auth, culture) |
| Medium | Scoped service as state container | Shared state within a feature |
| High | Fluxor (Redux pattern) | Complex multi-feature state, time-travel debugging |

## Component State

- Use private fields for local UI state:
  ```csharp
  @code {
      private bool _isExpanded;
      private string _searchTerm = string.Empty;

      private void ToggleExpand() => _isExpanded = !_isExpanded;
  }
  ```
- Parent-to-child via `[Parameter]`, child-to-parent via `EventCallback`:
  ```csharp
  // Parent
  <SearchBox Value="@_query" ValueChanged="HandleSearch" />

  // Child
  [Parameter] public string Value { get; set; } = string.Empty;
  [Parameter] public EventCallback<string> ValueChanged { get; set; }

  private async Task OnInput(ChangeEventArgs e)
  {
      await ValueChanged.InvokeAsync(e.Value?.ToString() ?? string.Empty);
  }
  ```

## Cascading Values

Use for app-wide concerns only — not for general data sharing:
```razor
<!-- App.razor or layout -->
<CascadingValue Value="@_theme" Name="AppTheme">
    @Body
</CascadingValue>

<!-- Any descendant -->
@code {
    [CascadingParameter(Name = "AppTheme")]
    private ThemeInfo Theme { get; set; } = default!;
}
```

Rules:
- Always use `Name` to avoid type collisions.
- Use `IsFixed="true"` when the value never changes (performance optimization).
- Avoid cascading frequently-changing values — causes re-render of all descendants.
- Prefer DI services over cascading for data that changes often.

## Scoped State Container (recommended for features)

```csharp
// Service
public class CartState
{
    private readonly List<CartItem> _items = [];

    public IReadOnlyList<CartItem> Items => _items.AsReadOnly();
    public decimal Total => _items.Sum(i => i.Price * i.Quantity);

    public event Action? OnChange;

    public void AddItem(CartItem item)
    {
        _items.Add(item);
        NotifyStateChanged();
    }

    public void RemoveItem(int productId)
    {
        _items.RemoveAll(i => i.ProductId == productId);
        NotifyStateChanged();
    }

    private void NotifyStateChanged() => OnChange?.Invoke();
}

// Registration
builder.Services.AddScoped<CartState>();

// Component
@inject CartState Cart
@implements IDisposable

<p>Total: @Cart.Total</p>

@code {
    protected override void OnInitialized()
    {
        Cart.OnChange += StateHasChanged;
    }

    public void Dispose()
    {
        Cart.OnChange -= StateHasChanged;
    }
}
```

## Fluxor (Complex State)

Use when you need predictable state mutations, middleware, time-travel debugging:
```csharp
// State
[FeatureState]
public record CounterState(int Count)
{
    public CounterState() : this(0) { }
}

// Actions
public record IncrementCounterAction;
public record SetCounterAction(int Value);

// Reducers
public static class CounterReducers
{
    [ReducerMethod]
    public static CounterState OnIncrement(CounterState state, IncrementCounterAction action)
        => state with { Count = state.Count + 1 };

    [ReducerMethod]
    public static CounterState OnSet(CounterState state, SetCounterAction action)
        => state with { Count = action.Value };
}

// Effects (side effects like API calls)
public class CounterEffects(ICounterApi api)
{
    [EffectMethod]
    public async Task HandleLoadAction(LoadCounterAction action, IDispatcher dispatcher)
    {
        var count = await api.GetCurrentCountAsync();
        dispatcher.Dispatch(new SetCounterAction(count));
    }
}

// Component
@inherits Fluxor.Blazor.Web.Components.FluxorComponent
@inject IState<CounterState> CounterState
@inject IDispatcher Dispatcher

<p>Count: @CounterState.Value.Count</p>
<button @onclick="Increment">+1</button>

@code {
    private void Increment() => Dispatcher.Dispatch(new IncrementCounterAction());
}
```

## Persisting State Across Circuits

Use `PersistentComponentState` for prerendering scenarios:
```csharp
@inject PersistentComponentState ApplicationState

@code {
    private PersistingComponentStateSubscription _subscription;
    private UserProfile? _profile;

    protected override async Task OnInitializedAsync()
    {
        _subscription = ApplicationState.RegisterOnPersisting(PersistState);

        if (!ApplicationState.TryTakeFromJson<UserProfile>("profile", out _profile))
        {
            _profile = await UserService.GetProfileAsync();
        }
    }

    private Task PersistState()
    {
        ApplicationState.PersistAsJson("profile", _profile);
        return Task.CompletedTask;
    }

    public void Dispose() => _subscription.Dispose();
}
```

## Anti-Patterns

1. **Cascading everything** — causes unnecessary re-renders in deep trees. Use DI services.
2. **Calling `StateHasChanged()` directly in service callbacks** — subscribe to events and call from the component.
3. **Mutable shared state without notification** — always raise `OnChange` after mutations.
4. **Storing UI state in services** — keep toggle/expand state in components, share only domain state.
5. **Fluxor for simple state** — don't add Redux overhead for a counter or form.
6. **Not unsubscribing from events** — always implement `IDisposable` and remove event handlers.

## References

- [Blazor state management](https://learn.microsoft.com/en-us/aspnet/core/blazor/state-management)
- [Cascading values](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/cascading-values-and-parameters)
- [Fluxor](https://github.com/mrpmorris/Fluxor)
- [PersistentComponentState](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/prerender#persist-prerendered-state)
