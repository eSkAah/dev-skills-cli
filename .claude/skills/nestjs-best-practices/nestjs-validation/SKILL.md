---
name: nestjs-validation
description: NestJS validation — class-validator, ValidationPipe, custom validators, DTO patterns, transform pipes
---

# NestJS Validation Best Practices

Apply these rules when defining DTOs or validating request data.

## Global ValidationPipe

Must be configured in `main.ts`:
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // Strip properties not in DTO
    forbidNonWhitelisted: true, // Throw on unknown properties
    transform: true,            // Auto-transform to DTO types
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

## DTO Decorators

```typescript
import {
  IsString, IsEmail, IsInt, IsOptional, IsEnum,
  Length, Min, Max, Matches, ValidateNested,
  IsArray, ArrayMinSize, Transform,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @Length(2, 50)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message: 'Password must contain uppercase, lowercase, and number (min 8 chars)',
  })
  password: string;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(120)
  age?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Role, { each: true })
  roles?: Role[];
}
```

## Rules

- Every DTO field must have at least one validation decorator.
- Always provide custom error `message` for user-facing validation.
- Use `@Transform` for sanitization (trim, lowercase) — validate after transform.
- Use `@Type(() => NestedDto)` with `@ValidateNested()` for nested objects.
- Use `@IsOptional()` before other decorators for optional fields.
- Inherit with `PartialType(CreateDto)` for update DTOs.

## Custom Validators

For domain rules (unique email, valid product code):
```typescript
@ValidatorConstraint({ name: 'isUnique', async: true })
@Injectable()
export class IsUniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly service: SomeService) {}

  async validate(value: string): Promise<boolean> {
    return !(await this.service.exists(value));
  }

  defaultMessage(): string {
    return '$property already exists';
  }
}
```

Register via `useContainer(app.select(AppModule), { fallbackOnErrors: true })` in `main.ts`.

## Built-in Pipes

Use NestJS built-in pipes for parameter validation:
```typescript
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {}

@Get()
findAll(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) {}

@Get(':uuid')
findByUuid(@Param('uuid', ParseUUIDPipe) uuid: string) {}
```

## Anti-Patterns

1. No validation on DTOs — every field must be validated.
2. Validating in the service instead of the DTO — validate at the boundary.
3. Using entity classes as request DTOs — entities expose internal structure.
4. Missing `whitelist: true` — allows injection of unexpected properties.
5. Custom validation in controllers — use pipes or DTO decorators.

## References

- [NestJS Validation](https://docs.nestjs.com/techniques/validation)
- [class-validator decorators](https://github.com/typestack/class-validator#validation-decorators)
- [class-transformer](https://github.com/typestack/class-transformer)
- [NestJS Pipes](https://docs.nestjs.com/pipes)
