---
name: nestjs-testing
description: NestJS testing — unit tests with Jest, e2e tests with Supertest, TestingModule, mocking strategies
---

# NestJS Testing Best Practices

Apply these rules when writing tests for NestJS services, controllers, or the full API.

## Unit Tests — Services

Use `Test.createTestingModule` to create an isolated module with mocked dependencies:

```typescript
describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  it('should throw ResourceNotFoundException when user not found', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.findById(999)).rejects.toThrow(ResourceNotFoundException);
  });

  it('should create and return a user', async () => {
    const dto: CreateUserDto = { name: 'John', email: 'john@example.com', password: 'Pass123!' };
    const saved = { id: 1, ...dto };
    repository.save.mockResolvedValue(saved as User);

    const result = await service.create(dto);
    expect(result).toEqual(saved);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ email: dto.email }));
  });
});
```

## Unit Tests — Controllers

Test that controllers delegate correctly — don't test business logic here:

```typescript
describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: { findById: jest.fn(), create: jest.fn() } },
      ],
    }).compile();

    controller = module.get(UsersController);
    service = module.get(UsersService);
  });

  it('should return user from service', async () => {
    const user = { id: 1, name: 'John' };
    service.findById.mockResolvedValue(user as any);
    expect(await controller.findOne(1)).toEqual(user);
  });
});
```

## E2E Tests

Test the full request lifecycle with Supertest:

```typescript
describe('Users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('POST /users — creates user with valid data', () =>
    request(app.getHttpServer())
      .post('/users')
      .send({ name: 'John', email: 'john@test.com', password: 'Pass123!' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body).not.toHaveProperty('password');
      }));

  it('POST /users — rejects invalid email', () =>
    request(app.getHttpServer())
      .post('/users')
      .send({ name: 'John', email: 'invalid', password: 'Pass123!' })
      .expect(400));

  it('GET /users/:id — 404 for non-existent user', () =>
    request(app.getHttpServer())
      .get('/users/999')
      .expect(404));
});
```

## Mocking Strategy

- **Mock repositories** in unit tests — provide fake implementations via `useValue`.
- **Mock external services** (HTTP, email, payment) — never call real APIs in tests.
- **Don't mock** the module under test or NestJS internals.
- Use `jest.clearAllMocks()` in `beforeEach` to prevent state leaks.
- For e2e, use a **test database** (SQLite in-memory or Docker container) — never mock the DB in e2e.

## What to Test

| Layer | Test type | What to verify |
|-------|-----------|----------------|
| Service | Unit | Business logic, error throwing, data transformation |
| Controller | Unit | Correct delegation to service, parameter parsing |
| Full API | E2E | HTTP status codes, response shape, validation, auth |
| Guards | Unit | Allow/deny logic for different user roles |
| Pipes | Unit | Validation/transformation behavior |

## Anti-Patterns

1. Testing implementation details (which internal method was called) — test outcomes.
2. Sharing state between tests — each test gets a fresh module.
3. Mocking everything — only mock what crosses boundaries (DB, HTTP, filesystem).
4. No e2e tests — unit tests alone miss integration issues (pipes, guards, interceptors).
5. Testing with production database.

## References

- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Jest docs](https://jestjs.io/docs/getting-started)
- [Supertest](https://github.com/ladjs/supertest)
