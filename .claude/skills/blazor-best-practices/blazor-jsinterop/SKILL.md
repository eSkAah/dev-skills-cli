---
name: blazor-jsinterop
description: Blazor JavaScript interop — IJSRuntime, IJSObjectReference, module import/disposal, DOM interaction patterns
---

# Blazor JS Interop Best Practices

Apply these rules when calling JavaScript from Blazor or calling .NET from JavaScript.

## Module Pattern (recommended)

Import JS modules in `OnAfterRenderAsync`, dispose in `IAsyncDisposable`:
```csharp
@inject IJSRuntime JS
@implements IAsyncDisposable

@code {
    private IJSObjectReference? _module;

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            _module = await JS.InvokeAsync<IJSObjectReference>(
                "import", "./js/chart.js");
            await _module.InvokeVoidAsync("initialize", _chartElement);
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_module is not null)
        {
            try
            {
                await _module.InvokeVoidAsync("dispose");
                await _module.DisposeAsync();
            }
            catch (JSDisconnectedException)
            {
                // Circuit disconnected — safe to ignore
            }
        }
    }
}
```

```javascript
// wwwroot/js/chart.js
let chart;

export function initialize(element) {
    chart = new Chart(element, { /* config */ });
}

export function updateData(data) {
    chart.data = data;
    chart.update();
}

export function dispose() {
    chart?.destroy();
}
```

## Calling JavaScript from .NET

```csharp
// Invoke with return value
var width = await JS.InvokeAsync<int>("getWindowWidth");

// Invoke without return
await JS.InvokeVoidAsync("console.log", "Hello from Blazor");

// Invoke on module reference
await _module.InvokeVoidAsync("showToast", "Success!", "info");

// With timeout
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
var result = await JS.InvokeAsync<string>("longOperation", cts.Token);
```

## Calling .NET from JavaScript

```csharp
// Instance method
private DotNetObjectReference<MyComponent>? _dotNetRef;

protected override void OnInitialized()
{
    _dotNetRef = DotNetObjectReference.Create(this);
}

[JSInvokable]
public void HandleJsCallback(string data)
{
    _message = data;
    StateHasChanged(); // Required — JS calls don't auto-trigger render
}

// Pass to JS
await _module.InvokeVoidAsync("registerCallback", _dotNetRef);

public void Dispose()
{
    _dotNetRef?.Dispose();
}
```

```javascript
// In JS
export function registerCallback(dotNetRef) {
    document.addEventListener('custom-event', (e) => {
        dotNetRef.invokeMethodAsync('HandleJsCallback', e.detail);
    });
}
```

Static .NET methods:
```csharp
[JSInvokable]
public static string FormatCurrency(decimal amount)
    => amount.ToString("C");
```

```javascript
const result = await DotNet.invokeMethodAsync('MyApp', 'FormatCurrency', 42.5);
```

## Element References

```razor
<canvas @ref="_canvasRef"></canvas>

@code {
    private ElementReference _canvasRef;

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            await _module.InvokeVoidAsync("initCanvas", _canvasRef);
        }
    }
}
```

## Performance Rules

| Rule | Why |
|------|-----|
| Batch calls | Each interop call has overhead (especially SignalR in Server) |
| Throttle in JS | Don't send `scroll`/`mousemove` events to .NET directly |
| Use `InvokeVoidAsync` when no return needed | Avoids unnecessary serialization |
| Import modules, not global scripts | Better tree-shaking and isolation |
| Use `CancellationToken` | Prevents hanging calls when component disposes |

## Error Handling

Always catch `JSDisconnectedException` during disposal in Blazor Server:
```csharp
public async ValueTask DisposeAsync()
{
    if (_module is not null)
    {
        try
        {
            await _module.DisposeAsync();
        }
        catch (JSDisconnectedException)
        {
            // Expected when SignalR circuit is disconnected
        }
    }

    _dotNetRef?.Dispose();
}
```

## DOM Rules

- **Never mutate DOM elements rendered by Blazor** — causes undefined behavior. Blazor owns its render tree.
- Only interact with elements Blazor doesn't manage (third-party widgets, canvas, maps).
- Use `ElementReference` to pass elements to JS — don't query the DOM with `document.getElementById`.

## Collocated JS Files (.NET 8+)

Place JS alongside components for automatic bundling:
```
Components/
  Chart.razor
  Chart.razor.js    ← Automatically served at ./Components/Chart.razor.js
  Chart.razor.css
```

Import with relative path:
```csharp
_module = await JS.InvokeAsync<IJSObjectReference>(
    "import", "./Components/Chart.razor.js");
```

## Anti-Patterns

1. **Global `<script>` tags for component JS** — use ES modules with `import`.
2. **JS interop in `OnInitialized`** — DOM isn't available; use `OnAfterRenderAsync`.
3. **Forgetting to dispose `IJSObjectReference`** — memory leak.
4. **Forgetting to dispose `DotNetObjectReference`** — prevents GC of .NET object.
5. **High-frequency .NET → JS calls** — throttle/debounce on the JS side.
6. **Mutating Blazor-rendered DOM in JS** — will conflict with Blazor's diffing.
7. **Ignoring `JSDisconnectedException`** — crashes during circuit disconnection in Server.

## References

- [Blazor JS interop](https://learn.microsoft.com/en-us/aspnet/core/blazor/javascript-interoperability/)
- [Call JS from .NET](https://learn.microsoft.com/en-us/aspnet/core/blazor/javascript-interoperability/call-javascript-from-dotnet)
- [Call .NET from JS](https://learn.microsoft.com/en-us/aspnet/core/blazor/javascript-interoperability/call-dotnet-from-javascript)
- [JS interop performance](https://learn.microsoft.com/en-us/aspnet/core/blazor/performance/javascript-interoperability)
