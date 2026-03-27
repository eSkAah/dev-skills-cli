---
name: blazor-testing
description: Blazor testing patterns — bUnit unit tests, Playwright E2E, mocking services, async patterns
---

# Blazor Testing Best Practices

Apply these rules when writing or modifying test files.

## Philosophy

Test **behavior**, not implementation. Verify what the user sees and experiences, not how the component internally works.

## bUnit — Component Unit Testing

### Setup

```csharp
// Install: dotnet add package bunit
// Works with xUnit, NUnit, MSTest, TUnit

using Bunit;
using Xunit;

public class CounterTests : BunitContext
{
    [Fact]
    public void Counter_ShouldIncrementOnClick()
    {
        // Arrange
        var cut = Render<Counter>();

        // Act
        cut.Find("button").Click();

        // Assert
        cut.Find("p").MarkupMatches("<p>Current count: 1</p>");
    }
}
```

### Mocking Services

```csharp
public class UserListTests : BunitContext
{
    [Fact]
    public void ShouldDisplayUsers()
    {
        // Arrange
        var mockService = Substitute.For<IUserService>(); // NSubstitute
        mockService.GetAllAsync().Returns(new List<UserDto>
        {
            new("1", "Alice"),
            new("2", "Bob")
        });

        Services.AddSingleton(mockService);

        // Act
        var cut = Render<UserList>();

        // Assert
        var items = cut.FindAll("li");
        Assert.Equal(2, items.Count);
        items[0].MarkupMatches("<li>Alice</li>");
    }
}
```

### Testing Parameters

```csharp
[Fact]
public void ShouldRenderWithParameters()
{
    var cut = Render<UserCard>(parameters => parameters
        .Add(p => p.Name, "Alice")
        .Add(p => p.Role, "Admin")
        .Add(p => p.OnClick, () => { })
    );

    cut.Find("h3").MarkupMatches("<h3>Alice</h3>");
    cut.Find("span").MarkupMatches("<span>Admin</span>");
}
```

### Testing Cascading Parameters

```csharp
[Fact]
public void ShouldRespectTheme()
{
    var theme = new ThemeInfo { IsDark = true };

    var cut = Render<ThemedCard>(parameters => parameters
        .AddCascadingValue("AppTheme", theme)
    );

    Assert.Contains("dark", cut.Markup);
}
```

### Testing EventCallback

```csharp
[Fact]
public void ShouldFireEventOnClick()
{
    var clicked = false;

    var cut = Render<DeleteButton>(parameters => parameters
        .Add(p => p.OnDelete, () => { clicked = true; })
    );

    cut.Find("button").Click();

    Assert.True(clicked);
}
```

### Async Testing

```csharp
[Fact]
public async Task ShouldLoadDataOnInit()
{
    var mockService = Substitute.For<IUserService>();
    mockService.GetAllAsync().Returns(Task.FromResult<IList<UserDto>>(
        new List<UserDto> { new("1", "Alice") }
    ));

    Services.AddSingleton(mockService);

    var cut = Render<UserList>();

    // Wait for async OnInitializedAsync to complete
    cut.WaitForState(() => cut.FindAll("li").Count > 0);

    Assert.Single(cut.FindAll("li"));
}
```

### Semantic HTML Comparison

bUnit uses a semantic HTML comparer — whitespace, attribute order, and comment differences are ignored:
```csharp
// These are equivalent
cut.Find("div").MarkupMatches("<div class='a b'></div>");
cut.Find("div").MarkupMatches("<div  class='b a' ></div>");
```

## Playwright — E2E Testing

### Setup

```csharp
using Microsoft.Playwright;

public class LoginE2ETests : IAsyncLifetime
{
    private IPlaywright _playwright = null!;
    private IBrowser _browser = null!;
    private IPage _page = null!;

    public async Task InitializeAsync()
    {
        _playwright = await Playwright.CreateAsync();
        _browser = await _playwright.Chromium.LaunchAsync();
        _page = await _browser.NewPageAsync();
    }

    [Fact]
    public async Task ShouldLoginSuccessfully()
    {
        await _page.GotoAsync("https://localhost:5001/login");

        await _page.FillAsync("[data-testid=email]", "user@test.com");
        await _page.FillAsync("[data-testid=password]", "password123");
        await _page.ClickAsync("button[type=submit]");

        // Wait for navigation — don't use fixed delays
        await _page.WaitForURLAsync("**/dashboard");

        var heading = await _page.TextContentAsync("h1");
        Assert.Equal("Dashboard", heading);
    }

    public async Task DisposeAsync()
    {
        await _browser.DisposeAsync();
        _playwright.Dispose();
    }
}
```

### Blazor-Specific E2E Rules

- Wait for network idle or specific elements — Blazor Server has SignalR latency.
- Use `Expect()` with `ToBeVisibleAsync()` instead of fixed delays.
- For Blazor WebAssembly, wait for `_framework/blazor.webassembly.js` to finish loading.
- Use Playwright codegen (`pwsh bin/Debug/net9.0/playwright.ps1 codegen`) to record interactions.

## What to Test / What NOT to Test

**Test (bUnit):**
- Component rendering based on parameters
- User interactions (click, input, form submit)
- Conditional rendering (if/else in markup)
- Event callbacks fire correctly
- Service integration (with mocked services)

**Test (Playwright):**
- Full user workflows (login → navigate → action)
- Cross-component interactions
- Real API integration (staging environment)

**Don't test:**
- Framework internals (routing, DI, lifecycle itself).
- CSS styling — use visual regression tools.
- Private methods or internal state directly.
- Third-party component internals (MudBlazor, Radzen).

## Anti-Patterns

1. **Using `Thread.Sleep` or `Task.Delay` in tests** — use `WaitForState`, `WaitForAssertion`, or Playwright's `WaitFor*`.
2. **Testing implementation details** — verify visible output, not internal state.
3. **Not mocking external services in bUnit** — unit tests must be isolated.
4. **Shared mutable state between tests** — use fresh context per test.
5. **Snapshot overuse** — breaks on every markup change, hides real regressions.
6. **No E2E tests** — bUnit alone doesn't catch integration issues.

## References

- [bUnit docs](https://bunit.dev/)
- [bUnit getting started](https://bunit.dev/docs/getting-started/)
- [ASP.NET Core Blazor testing](https://learn.microsoft.com/en-us/aspnet/core/blazor/test)
- [Playwright .NET](https://playwright.dev/dotnet/)
- [NSubstitute](https://nsubstitute.github.io/)
