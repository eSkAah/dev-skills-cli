---
name: nestjs
description: NestJS + TypeScript backend development — dispatches to specialized sub-skills based on the task
---

# NestJS Development Guide

Use this skill when working on NestJS backend `.ts` files.

## Choose the Right Sub-Skill

| Task | Skill | When to use |
|------|-------|-------------|
| Structuring modules/features | `/nestjs-architecture` | Modules, controllers, services, DTOs, DI, project structure |
| Validating input | `/nestjs-validation` | class-validator, ValidationPipe, custom validators, DTOs |
| Handling errors | `/nestjs-error-handling` | Exception filters, custom exceptions, logging interceptors |
| Writing tests | `/nestjs-testing` | Unit tests (Jest), e2e tests (Supertest), mocking, TestingModule |
| Securing the API | `/nestjs-security` | Guards (JWT, RBAC), helmet, CORS, rate limiting, bcrypt |
| Optimizing performance | `/nestjs-performance` | Caching (Redis), compression, connection pooling, interceptors |

## Universal Rules (always apply)

- **No business logic in controllers** — controllers delegate to services.
- **No entities in responses** — always use DTOs for request and response.
- **No `any`** — strict TypeScript everywhere.
- **No circular dependencies** — extract shared services or use events.
- **No raw SQL without parameterization** — prevent SQL injection.
- **No secrets in code** — use `ConfigService` and environment variables.
- **No `synchronize: true` in production** — use migrations.

## Quick References

- [NestJS docs](https://docs.nestjs.com/)
- [NestJS modules](https://docs.nestjs.com/modules)
- [NestJS testing](https://docs.nestjs.com/fundamentals/testing)
- [NestJS security](https://docs.nestjs.com/security/authentication)
- [class-validator](https://github.com/typestack/class-validator)
