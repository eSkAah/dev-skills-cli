---
name: nestjs-security
description: NestJS security — JWT authentication, RBAC guards, helmet, CORS, rate limiting, password hashing
---

# NestJS Security Best Practices

Apply these rules when implementing authentication, authorization, or securing endpoints.

## Authentication — JWT Guard

```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing or invalid token');
    }

    try {
      request['user'] = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token expired or invalid');
    }

    return true;
  }
}
```

## Authorization — Roles Guard

```typescript
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!roles.some((r) => user.roles?.includes(r))) {
      throw new ForbiddenException(`Required roles: ${roles.join(', ')}`);
    }
    return true;
  }
}

// Usage
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Delete(':id')
async remove(@Param('id') id: string) { ... }
```

## Custom Decorators

```typescript
// Extract current user from request
export const CurrentUser = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.user?.[data] : request.user;
  },
);

// Usage
@Get('profile')
getProfile(@CurrentUser() user: UserPayload) { ... }

@Get('name')
getName(@CurrentUser('name') name: string) { ... }
```

## main.ts Security Setup

```typescript
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

  // Rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
  }));

  await app.listen(3000);
}
```

## Password Hashing

Always use bcrypt — never store plaintext:
```typescript
import * as bcrypt from 'bcrypt';

async hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

## Rules

- Never store secrets in code — use `ConfigService` + `.env`.
- Never return passwords or tokens in API responses.
- Always validate and sanitize all user input (pipes + DTOs).
- Use HTTPS in production.
- Set short JWT expiration (15min access + long-lived refresh token).
- Log authentication failures for monitoring.
- Use `@Public()` decorator to explicitly mark unauthenticated routes — default to protected.

## Anti-Patterns

1. Hardcoded secrets: `jwt.sign(payload, 'my-secret')`.
2. Trusting client-side auth checks — always validate server-side.
3. Applying guards per-route instead of globally with opt-out.
4. Using `MD5` or `SHA256` for passwords — use bcrypt.
5. Missing rate limiting on auth endpoints — enables brute force.
6. CORS `origin: '*'` in production.

## References

- [NestJS Authentication](https://docs.nestjs.com/security/authentication)
- [NestJS Authorization](https://docs.nestjs.com/security/authorization)
- [NestJS Helmet](https://docs.nestjs.com/security/helmet)
- [NestJS CORS](https://docs.nestjs.com/security/cors)
- [OWASP API Security Top 10](https://owasp.org/API-Security/)
