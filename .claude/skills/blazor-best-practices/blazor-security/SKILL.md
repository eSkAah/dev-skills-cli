---
name: blazor-security
description: Blazor security — authentication, authorization, CSRF, XSS prevention, CSP, JWT patterns
---

# Blazor Security Best Practices

Apply these rules when implementing authentication, authorization, or securing a Blazor app.

## Authentication — AuthenticationStateProvider

```csharp
// Server-side setup (Program.cs)
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie();
builder.Services.AddCascadingAuthenticationState();
builder.Services.AddAuthenticationStateSerialization();

// Client-side setup (for Interactive Auto/WASM)
builder.Services.AddAuthenticationStateDeserialization();
```

## Authorization — AuthorizeView

```razor
<AuthorizeView>
    <Authorized>
        <p>Hello, @context.User.Identity?.Name</p>
        <NavLink href="dashboard">Dashboard</NavLink>
    </Authorized>
    <NotAuthorized>
        <p>Please <a href="/login">log in</a>.</p>
    </NotAuthorized>
    <Authorizing>
        <LoadingSpinner />
    </Authorizing>
</AuthorizeView>

<!-- Role-based -->
<AuthorizeView Roles="Admin,Manager">
    <Authorized>
        <AdminPanel />
    </Authorized>
</AuthorizeView>

<!-- Policy-based -->
<AuthorizeView Policy="CanEditUsers">
    <Authorized>
        <EditUserButton UserId="@userId" />
    </Authorized>
</AuthorizeView>
```

## Page-Level Authorization

```csharp
@page "/admin"
@attribute [Authorize(Roles = "Admin")]

// Or with policy
@attribute [Authorize(Policy = "RequireAdminRole")]
```

## JWT for API Calls (WebAssembly)

Use cookies for browser auth, JWT only for securing API calls:
```csharp
// HttpClient with JWT
public class AuthTokenHandler : DelegatingHandler
{
    private readonly ILocalStorageService _storage;

    public AuthTokenHandler(ILocalStorageService storage)
    {
        _storage = storage;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var token = await _storage.GetItemAsStringAsync("authToken");
        if (!string.IsNullOrEmpty(token))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        return await base.SendAsync(request, cancellationToken);
    }
}

// Registration
builder.Services.AddHttpClient("API", client =>
    client.BaseAddress = new Uri("https://api.example.com"))
    .AddHttpMessageHandler<AuthTokenHandler>();
```

## CSRF / Anti-Forgery

Blazor Server handles anti-forgery automatically for EditForm submissions (.NET 8+):
```csharp
// Program.cs
builder.Services.AddAntiforgery();
app.UseAntiforgery(); // Must be between UseRouting and UseEndpoints
```

For manual forms or custom endpoints:
```csharp
<AntiforgeryToken />
```

## XSS Prevention

Blazor auto-encodes all `@` expressions. The only XSS risk is `MarkupString`:
```csharp
// SAFE — auto-encoded
<p>@userInput</p>

// DANGEROUS — renders raw HTML
<p>@((MarkupString)userInput)</p>

// SAFE — only use MarkupString with trusted/sanitized content
<p>@((MarkupString)HtmlSanitizer.Sanitize(userInput))</p>
```

Rules:
- Never use `MarkupString` with user-supplied data.
- Store tokens in `sessionStorage`, not `localStorage` (cleared on tab close).
- Set `HttpOnly` and `Secure` flags on authentication cookies.
- Implement Content Security Policy headers:
  ```csharp
  app.Use(async (context, next) =>
  {
      context.Response.Headers.Append(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'");
      await next();
  });
  ```

## Security Headers

```csharp
// Program.cs
app.UseHsts();
app.UseHttpsRedirection();

// Custom security headers middleware
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    await next();
});
```

## Secure File Upload

```csharp
private async Task HandleFileUpload(InputFileChangeEventArgs e)
{
    var file = e.File;

    // 1. Validate file size
    const long maxSize = 5 * 1024 * 1024; // 5MB
    if (file.Size > maxSize)
    {
        _error = "File too large (max 5MB)";
        return;
    }

    // 2. Validate content type
    var allowedTypes = new[] { "image/jpeg", "image/png", "application/pdf" };
    if (!allowedTypes.Contains(file.ContentType))
    {
        _error = "File type not allowed";
        return;
    }

    // 3. Generate safe filename — never trust client filename
    var trustedFileName = Path.GetRandomFileName() + Path.GetExtension(file.Name);
    var path = Path.Combine(_uploadFolder, trustedFileName);

    // 4. Stream to disk — never buffer in memory
    await using var fs = new FileStream(path, FileMode.Create);
    await file.OpenReadStream(maxSize).CopyToAsync(fs);
}
```

## Rules

- Never store secrets in code — use `IConfiguration`, User Secrets, or Azure Key Vault.
- Never return sensitive data in error messages — use generic error codes.
- Always use HTTPS in production.
- Always validate authorization server-side — never rely on `AuthorizeView` alone.
- Set short JWT expiration (15 min access + refresh token).
- Keep dependencies updated — use Dependabot or Snyk.
- Log authentication failures for monitoring.
- Restrict CORS to trusted origins only.

## Anti-Patterns

1. **`MarkupString` with user input** — direct XSS vector.
2. **Client-only auth checks** — `AuthorizeView` hides UI but doesn't protect data.
3. **Tokens in `localStorage`** — vulnerable to XSS; use `sessionStorage` or `HttpOnly` cookies.
4. **CORS `*` in production** — allows any origin to call your API.
5. **Missing anti-forgery on custom forms** — enables CSRF attacks.
6. **Exposing stack traces** — use generic error pages in production.
7. **Trusting client-supplied filenames** — path traversal risk.

## References

- [Blazor authentication](https://learn.microsoft.com/en-us/aspnet/core/blazor/security/)
- [Blazor authorization](https://learn.microsoft.com/en-us/aspnet/core/blazor/security/authorization)
- [Anti-forgery in Blazor](https://learn.microsoft.com/en-us/aspnet/core/blazor/security/anti-forgery)
- [Blazor file uploads](https://learn.microsoft.com/en-us/aspnet/core/blazor/file-uploads)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
