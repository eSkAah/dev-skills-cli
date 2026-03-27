---
name: nestjs-error-handling
description: NestJS error handling — exception filters, custom exception hierarchy, logging interceptors, structured error responses
---

# NestJS Error Handling Best Practices

Apply these rules when handling errors, creating exception filters, or structuring error responses.

## Custom Exception Hierarchy

Create domain-specific exceptions extending `HttpException`:

```typescript
export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, id: string | number) {
    super(`${resource} with id ${id} not found`, HttpStatus.NOT_FOUND);
  }
}

export class DuplicateResourceException extends HttpException {
  constructor(field: string, value: string) {
    super(`${field} '${value}' already exists`, HttpStatus.CONFLICT);
  }
}

export class BusinessRuleException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class ExternalServiceException extends HttpException {
  constructor(service: string, message: string) {
    super(`${service}: ${message}`, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
```

Use these in services — never throw raw `Error` or generic `HttpException('error', 500)`.

## Global Exception Filter

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

    // Log 5xx errors with stack trace, 4xx as warnings
    if (status >= 500) {
      this.logger.error(message, (exception as Error).stack);
    } else {
      this.logger.warn(`${request.method} ${request.url} — ${status}: ${message}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

Register globally in `main.ts`: `app.useGlobalFilters(new AllExceptionsFilter())`.

## Logging Interceptor

For request/response logging and duration tracking:

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => this.logger.log(`${req.method} ${req.url} — ${Date.now() - start}ms`)),
    );
  }
}
```

## Rules

- Never return stack traces in production responses.
- Log 5xx with `error` level + stack trace. Log 4xx with `warn` level.
- Use `Logger` (NestJS built-in), not `console.log`.
- Always include `statusCode`, `message`, `timestamp`, and `path` in error responses.
- Services throw domain exceptions. Controllers never catch — let the filter handle it.
- Add a `requestId` header (`x-request-id`) for tracing across services.

## Anti-Patterns

1. `try/catch` in every controller method — use the global exception filter.
2. Throwing `new Error('...')` — use typed `HttpException` subclasses.
3. Silent error swallowing — always log before re-throwing or transforming.
4. Returning `{ success: false, error: '...' }` with status 200 — use proper HTTP status codes.
5. Logging sensitive data (passwords, tokens) in error messages.

## References

- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [NestJS Logger](https://docs.nestjs.com/techniques/logger)
- [NestJS Interceptors](https://docs.nestjs.com/interceptors)
