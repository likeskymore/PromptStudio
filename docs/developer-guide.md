# Developer Guide

This guide covers repository onboarding and the development workflow for PromptStudio. Use [Getting Started](getting-started.md) for the shortest path to running the application, [Architecture](architecture.md) for system boundaries, [Database](database.md) for persistence details, and [Testing and Quality](testing.md) for the test strategy.

## Tech stack

- Node.js 20 or later and npm.
- TypeScript with `tsx` for direct execution during development.
- Express 5 for the backend API.
- MySQL accessed through `mysql2`.
- Jest with `ts-jest` for backend, CLI, and configuration tests.
- Prettier and ESLint for formatting and static checks.
- Provider SDKs for OpenAI, Google, Anthropic, Azure OpenAI, and Amazon Bedrock integrations.

## Repository layout

- `backend/`: API routes, experiment execution, provider integrations, token estimation, persistence, and shared backend utilities.
- `backend/api/`: Express application setup, routes, workers, run state, and server entry point.
- `backend/database/`: MySQL connection and database schema.
- `headless/`: command-line runner and the client used to invoke backend operations.
- `files/`: example YAML workflows, datasets, processors, evaluators, and other experiment inputs.
- `tests/`: Jest tests for the CLI, configuration handling, runners, and integration behavior.
- `docs/`: user, architecture, testing, and contribution documentation.
- `uploads/`: local runtime uploads. Do not commit its contents.
- `credentials.json`: local provider and database configuration. This file must remain outside version control.

## Run the application

Start the backend API in one terminal:

```bash
npx tsx backend/api/server.ts
```

*The frontend dashboard is optional. If you want to use it, run the frontend separately by following the instructions provided in the dashboard project's README.*

The backend and frontend listen on ports `3001` and `3005`, respectively, by default.

For a headless run, place the YAML configuration and supporting files under `files/` and execute:

```bash
npx tsx headless/cli.ts --config files/YOUR_CONFIG_FILE.yml
```

A saved experiment can be rerun by name:

```bash
npx tsx headless/cli.ts --name YOUR_EXPERIMENT_NAME
```

The `--name` command calls `POST /experiments/run/:name/rerun`, which creates a fresh run and processes the existing inputs again without appending duplicate dataset rows. A new configuration uses the normal `GET /experiments/run/:name` endpoint. Both paths persist run snapshots through the backend API rather than introducing a second persistence path.

## Architecture and boundaries

PromptStudio has two cooperating runtime parts:

- The Express backend owns HTTP behavior, persistence, provider requests, token estimation, and experiment execution.
- The headless runner provides repeatable command-line execution through the backend API.

Keep HTTP concerns in `backend/api/`. Put experiment orchestration in the runner, evaluator, processor, and worker modules. Keep database access in `backend/database/` and related query helpers. Provider clients should remain behind small integrations so tests can inject fakes and avoid real network calls.

See [Database](database.md) for the schema source, connection setup, table responsibilities, run snapshots, and schema change workflow.

When adding a feature, follow the nearest existing module pattern. Keep route handlers thin, preserve the existing YAML and saved-experiment formats, and avoid adding frontend-only behavior that cannot be exercised through the backend or CLI when the behavior is shared.

## Testing and quality checks

Run a focused test while iterating, for example:

```bash
npx jest tests/cli.test.ts --runInBand
```

Run the project checks before opening a pull request:

```bash
npm run clean
npm test
npm run build
```

The npm scripts run Prettier and ESLint before the relevant test or build command. `npm test` runs Jest through the project configuration, which uses the Node test environment and `ts-jest` for TypeScript files.

Add or update tests for changes to:

- YAML parsing and experiment configuration validation.
- Token estimation and provider request shaping.
- API routes, persistence, and run state.
- Experiment runners, processors, evaluators, and workers.
- Headless CLI argument handling and error messages.

Provider tests must use mocked responses or injected fakes. Automated tests must not call real model APIs or depend on a developer's credentials.

## Working with experiments

Use ChainForge-compatible YAML when importing workflows. Keep reusable processors, evaluators, and sample datasets in `files/` only when they are suitable for the repository. Private or large datasets belong outside version control.

For changes that affect experiment execution, verify both a direct backend path and the corresponding headless command when practical. Saved experiment names and configuration compatibility are part of the public behavior; changing them requires updated tests and documentation.

## Security and runtime data

Never commit:

- `credentials.json` or API keys.
- Database passwords or connection dumps.
- Private datasets and uploaded files.
- Generated experiment results, logs, or temporary runtime state.

Use provider keys with appropriate access and spending limits. Treat experiment prompts and model outputs as potentially sensitive data when sharing logs or test fixtures.

## Contribution baseline

Before opening a pull request:

1. Keep changes scoped to the owning module and preserve existing public formats.
2. Add regression coverage for changed behavior.
3. Run focused tests, then `npm test` and `npm run build`.
4. Update the relevant user or developer documentation.
5. Review the diff for credentials, uploads, generated files, and unrelated formatting changes.

Update [Getting Started](getting-started.md) when setup changes, [Experiment workflows](experiments.md) when user workflows change, and [Architecture](architecture.md) or [Testing and Quality](testing.md) when development behavior changes.
