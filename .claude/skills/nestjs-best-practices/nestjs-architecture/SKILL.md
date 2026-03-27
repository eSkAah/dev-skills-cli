---
name: nestjs-architecture
description: NestJS project architecture — modules, controllers, services, DTOs, dependency injection, feature-based structure
---

# NestJS Architecture Best Practices

Apply these rules when creating modules, services, controllers, or structuring features.

## Feature-Based Structure

```
src/
├── modules/
│   └── [feature]/
│       ├── dto/
│       │   ├── create-[feature].dto.ts
│       │   └── update-[feature].dto.ts
│       ├── entities/
│       │   └── [feature].entity.ts
│       ├── [feature].controller.ts
│       ├── [feature].service.ts
│       └── [feature].module.ts
├── common/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   ├── decorators/
│   └── constants/
├── config/
└── main.ts
```

## Modules

- One module per feature/domain. Modules are the unit of encapsulation.
- Export only what other modules need — keep internals private.
- Create a `SharedModule` for cross-cutting concerns (logger, config, database):
  ```typescript
  @Module({
    providers: [LoggerService, DatabaseService],
    exports: [LoggerService, DatabaseService],
  })
  export class SharedModule {}
  ```
- Use `forRoot()` / `forRootAsync()` for configurable modules (database, cache, queue).

## Controllers

- Controllers handle HTTP concerns only: route, validate input, return response.
- Never inject repositories into controllers — always go through a service.
- One controller per feature, one method per endpoint.
- Always type return values:
  ```typescript
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserResponseDto> {
    return this.usersService.findById(id);
  }
  ```

## Services

- Services contain business logic. They are injectable and testable.
- Services call repositories/other services, transform data, enforce rules.
- Use `readonly` on injected dependencies:
  ```typescript
  constructor(private readonly usersRepository: Repository<User>) {}
  ```
- For async initialization, implement `OnModuleInit` — never use async constructors.

## DTOs

- Create separate DTOs: `CreateUserDto`, `UpdateUserDto`, `UserResponseDto`.
- Request DTOs carry validation decorators (class-validator).
- Response DTOs strip sensitive fields (password, internal IDs).
- Use `PartialType`, `PickType`, `OmitType`, `IntersectionType` from `@nestjs/mapped-types` to avoid duplication:
  ```typescript
  export class UpdateUserDto extends PartialType(CreateUserDto) {}
  ```

## Dependency Injection

- Prefer constructor injection over property injection.
- Avoid circular dependencies:
  1. **Best**: extract shared logic into a new service.
  2. **Alternative**: use `EventEmitter2` for decoupling.
  3. **Last resort**: `forwardRef(() => Service)`.

## Anti-Patterns

1. God module — one module with 20+ providers. Split by domain.
2. Controller with business logic — delegate everything to services.
3. Returning entities directly — always map to response DTOs.
4. Cross-module private access — use exports, not direct imports of internals.
5. `synchronize: true` in production TypeORM config.

## References

- [NestJS Modules](https://docs.nestjs.com/modules)
- [NestJS Controllers](https://docs.nestjs.com/controllers)
- [NestJS Providers](https://docs.nestjs.com/providers)
- [NestJS Mapped Types](https://docs.nestjs.com/openapi/mapped-types)
- [Bulletproof NestJS architecture](https://github.com/alan2207/bulletproof-react) (adapted for backend)
