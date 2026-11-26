# Testing and Quality

PromptStudio uses Jest 29 for unit and integration tests. Provider integrations should be tested with mocked responses or injected fakes; automated tests should not call real model APIs.

## Commands

```bash
npm test      # Format, lint, and run unit tests with Jest
npm run test:integration # Run database-backed YAML flow tests with Jest
npm run build # Format, lint, and create a production build
npm run clean # Format and lint only
```

The integration tests use Jest's ESM support and connect to the MySQL database configured by `DATABASE_HOST`,
`DATABASE_USER`, `DATABASE_PASSWORD`, and `DATABASE_NAME`. Apply Prisma migrations
before running it. It creates a uniquely named experiment and removes the records
it created when the test finishes; use a dedicated test database when possible.
The application and Prisma client are real in this test, while the worker's
deterministic mock model response avoids external provider calls. The integration
suite runs serially with Node's `--experimental-vm-modules` flag because Prisma 7
uses ESM.

Run focused tests while developing, then run `npm test` and `npm run build` before opening a pull request.

## Test coverage expectations

Add regression coverage for changes to:

- Experiment and YAML parsing
- Token estimation
- API behavior and persistence
- Provider request shaping
- Headless CLI behavior
- Prompt template substitution and evaluator/processor execution
- Worker latency configuration and API route validation

Prefer the narrowest useful test layer. Keep secrets, private datasets, local databases, uploads, logs, and generated outputs out of the repository.
