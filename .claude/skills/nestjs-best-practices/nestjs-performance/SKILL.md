---
name: nestjs-performance
description: NestJS performance — caching (Redis), compression, connection pooling, interceptors, query optimization
---

# NestJS Performance Best Practices

Apply these rules when optimizing API response times, database queries, or resource usage.

## Caching

### Service-Level Cache (Redis)

```typescript
@Injectable()
export class ProductsService {
  constructor(
    private readonly repo: Repository<Product>,
    private readonly cache: CacheService,
  ) {}

  async findById(id: string): Promise<Product> {
    const key = `product:${id}`;
    const cached = await this.cache.get<Product>(key);
    if (cached) return cached;

    const product = await this.repo.findOne({ where: { id } });
    if (!product) throw new ResourceNotFoundException('Product', id);

    await this.cache.set(key, product, 5 * 60 * 1000); // 5 min TTL
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.repo.save({ id, ...dto });
    await this.cache.del(`product:${id}`);  // Invalidate on write
    return product;
  }
}
```

### Cache Module Setup

```typescript
@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      ttl: 5 * 60 * 1000,
    }),
  ],
})
export class AppModule {}
```

### Rules

- Cache read-heavy, rarely-changing data (product catalogs, config, user profiles).
- Always invalidate cache on write (update, delete).
- Use hierarchical cache keys: `entity:id`, `entity:list:filter`.
- Set TTL — never cache indefinitely.

## Compression

Enable in `main.ts`:
```typescript
import compression from 'compression';
app.use(compression());
```

Reduces payload size by 60-80% for JSON responses.

## Database — Connection Pooling

```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  // ...credentials
  extra: {
    max: 20,                    // Max pool connections
    idleTimeoutMillis: 30000,   // Close idle after 30s
    connectionTimeoutMillis: 5000,
  },
})
```

## Database — Query Optimization

- Use `select` to fetch only needed columns:
  ```typescript
  this.repo.find({ select: ['id', 'name', 'price'] });
  ```
- Use `relations` or `QueryBuilder.leftJoinAndSelect` instead of N+1 queries.
- Add database indexes for columns used in WHERE, ORDER BY, JOIN.
- Use pagination — never return unbounded lists:
  ```typescript
  this.repo.find({ skip: (page - 1) * limit, take: limit });
  ```
- Use `createQueryBuilder` for complex queries — avoid loading full entity graphs.

## Response Optimization

### Serialization Interceptor

Strip fields and transform responses consistently:
```typescript
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        statusCode: context.switchToHttp().getResponse().statusCode,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### Streaming for Large Responses

```typescript
@Get('export')
async exportCsv(@Res() res: Response) {
  res.setHeader('Content-Type', 'text/csv');
  const stream = await this.service.createExportStream();
  stream.pipe(res);
}
```

## Background Jobs

For CPU-intensive or slow operations, use a queue instead of blocking the request:
```typescript
@Post('reports')
async generateReport(@Body() dto: ReportDto) {
  const job = await this.reportQueue.add('generate', dto);
  return { jobId: job.id, status: 'queued' };
}
```

Use `@nestjs/bull` or `@nestjs/bullmq` with Redis.

## Anti-Patterns

1. No pagination — returning 10,000 rows in one response.
2. N+1 queries — loading related entities in a loop.
3. Caching without invalidation — serving stale data.
4. Blocking the event loop — synchronous CPU work in request handlers.
5. Fetching `SELECT *` when only 2 fields are needed.
6. Missing database indexes on frequently queried columns.

## References

- [NestJS Caching](https://docs.nestjs.com/techniques/caching)
- [NestJS Queues](https://docs.nestjs.com/techniques/queues)
- [NestJS Performance](https://docs.nestjs.com/techniques/performance)
- [TypeORM Query Builder](https://typeorm.io/select-query-builder)
