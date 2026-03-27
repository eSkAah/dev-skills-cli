---
name: blazor-form
description: Blazor form patterns — EditForm, DataAnnotations, FluentValidation, custom validation, accessibility
---

# Blazor Form Best Practices

Apply these rules when building forms in Blazor components.

## Core Pattern — EditForm

```razor
<EditForm Model="@_model" OnValidSubmit="HandleSubmit" FormName="user-form">
    <DataAnnotationsValidator />
    <ValidationSummary />

    <div class="form-group">
        <label for="name">Name</label>
        <InputText id="name" @bind-Value="_model.Name" class="form-control" />
        <ValidationMessage For="() => _model.Name" />
    </div>

    <div class="form-group">
        <label for="email">Email</label>
        <InputText id="email" @bind-Value="_model.Email" type="email" class="form-control" />
        <ValidationMessage For="() => _model.Email" />
    </div>

    <div class="form-group">
        <label for="role">Role</label>
        <InputSelect id="role" @bind-Value="_model.Role" class="form-control">
            <option value="">-- Select --</option>
            <option value="Admin">Admin</option>
            <option value="User">User</option>
        </InputSelect>
        <ValidationMessage For="() => _model.Role" />
    </div>

    <button type="submit" disabled="@_isSubmitting">Save</button>
</EditForm>

@code {
    private UserFormModel _model = new();
    private bool _isSubmitting;

    private async Task HandleSubmit()
    {
        _isSubmitting = true;
        try
        {
            await UserService.CreateAsync(_model);
            NavigationManager.NavigateTo("/users");
        }
        finally
        {
            _isSubmitting = false;
        }
    }
}
```

## Form Events

| Event | When to use |
|-------|-------------|
| `OnValidSubmit` | Only fires if model passes validation — most common choice |
| `OnInvalidSubmit` | Fires when validation fails — use for analytics or error focus |
| `OnSubmit` | Always fires — use when you handle validation yourself |

Never use `OnSubmit` and `OnValidSubmit`/`OnInvalidSubmit` together on the same form.

## Model Validation with DataAnnotations

```csharp
public class UserFormModel
{
    [Required(ErrorMessage = "Name is required")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be 2-100 characters")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Role is required")]
    public string Role { get; set; } = string.Empty;

    [Range(18, 120, ErrorMessage = "Age must be between 18 and 120")]
    public int Age { get; set; }

    [Compare(nameof(Password), ErrorMessage = "Passwords must match")]
    public string ConfirmPassword { get; set; } = string.Empty;
}
```

## FluentValidation (complex rules)

```csharp
// Validator
public class UserFormValidator : AbstractValidator<UserFormModel>
{
    public UserFormValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .Length(2, 100);

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MustAsync(BeUniqueEmail).WithMessage("Email already in use");
    }

    private async Task<bool> BeUniqueEmail(string email, CancellationToken ct)
        => !await _userService.EmailExistsAsync(email, ct);
}

// Registration (with Blazored.FluentValidation)
<EditForm Model="@_model" OnValidSubmit="HandleSubmit">
    <FluentValidationValidator />
    ...
</EditForm>
```

## Server-Side Validation

Always validate on the server — client-side validation can be bypassed:
```csharp
private async Task HandleSubmit()
{
    var result = await UserService.CreateAsync(_model);

    if (!result.IsSuccess)
    {
        // Add server errors to EditContext
        foreach (var error in result.Errors)
        {
            _editContext.AddValidationMessage(
                () => _model.GetType().GetProperty(error.Field),
                error.Message);
        }
    }
}
```

## Built-In Input Components

| Component | Binds to |
|-----------|----------|
| `InputText` | `string` |
| `InputTextArea` | `string` (multiline) |
| `InputNumber<T>` | `int`, `double`, `decimal` |
| `InputDate<T>` | `DateTime`, `DateOnly`, `DateTimeOffset` |
| `InputCheckbox` | `bool` |
| `InputSelect<T>` | Enum, `string`, `int` |
| `InputRadio<T>` | Within `InputRadioGroup<T>` |
| `InputFile` | File upload (special handling) |

## Accessibility

- Every input must have a `<label>` with matching `for`/`id`.
- Use `<fieldset>` and `<legend>` for logical groups (radio buttons, checkboxes).
- Place `<ValidationMessage>` adjacent to its input.
- Use `aria-describedby` to associate validation messages:
  ```razor
  <InputText id="name" @bind-Value="_model.Name" aria-describedby="name-error" />
  <ValidationMessage For="() => _model.Name" id="name-error" />
  ```
- Disable submit button during processing to prevent double submission.
- Announce form errors to screen readers with `role="alert"` on error summaries.

## Anti-Patterns

1. **Manual `@onchange` instead of `@bind-Value`** — loses validation integration.
2. **Using `OnSubmit` without validation** — silently accepts invalid data.
3. **Trusting only client-side validation** — always validate server-side.
4. **Missing labels on inputs** — breaks accessibility and form semantics.
5. **One model for create + edit + display** — use separate models per use case.
6. **Not disabling submit during processing** — enables double submission.

## References

- [Blazor forms overview](https://learn.microsoft.com/en-us/aspnet/core/blazor/forms/)
- [Blazor forms validation](https://learn.microsoft.com/en-us/aspnet/core/blazor/forms/validation)
- [Input components](https://learn.microsoft.com/en-us/aspnet/core/blazor/forms/input-components)
- [Blazored.FluentValidation](https://github.com/Blazored/FluentValidation)
