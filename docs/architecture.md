# Architecture

PromptStudio has two core runtime parts:

- The Express backend owns HTTP behavior, persistence, provider requests, and experiment execution.
- The headless runner invokes the backend API for repeatable command-line runs.

The backend and headless runner are the stable execution boundary. An optional React dashboard lives in a separate repository and uses the same API contracts as the CLI rather than introducing a separate experiment or persistence path.

## Runtime architecture

```text
Optional React dashboard (separate repo) ──HTTP──> Express API ──> experiment services ──> workers/runners
													│                    │                    │
													├──> MySQL           └──> provider adapters
													└──> run state and logs

Headless CLI ───HTTP────> Express API
```

The API creates and coordinates runs. Experiment runners, processors, evaluators, and workers perform the execution work. Database writes and run-state transitions remain visible through the backend so dashboard and CLI behavior stay consistent.

## Repository layout

```text
backend/    API routes, experiment services, provider integrations, and shared backend code
backend/api/ Express app, routes, workers, run state, and server entry point
backend/database/ MySQL connection and schema definition
files/      Example YAML workflows, datasets, processors, and evaluators
headless/   Command-line runner and backend API client
tests/      Jest tests for backend, CLI, configuration, and integration behavior
docs/       User, architecture, testing, and contribution documentation
uploads/    Local runtime uploads; never commit its contents
```

## Module structure

The backend is intentionally split by responsibility. Representative modules include:

| Area                              | Responsibility                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `backend/api/routes/`             | HTTP endpoints, request parsing, response formatting, and route-level validation. |
| `backend/api/app.ts`              | Express application construction and middleware registration.                     |
| `backend/api/runner.ts`           | API-facing experiment run orchestration.                                          |
| `backend/api/ExperimentRunner.ts` | Execution of configured experiment nodes and inputs.                              |
| `backend/api/EvaluatorRunner.ts`  | Evaluation of experiment outputs.                                                 |
| `backend/api/processor.ts`        | Processor execution and transformation of intermediate values.                    |
| `backend/api/worker.ts`           | Background task execution and coordination.                                       |
| `backend/api/runState.ts`         | In-memory run state exposed to API clients.                                       |
| `backend/database/`               | MySQL connection lifecycle and schema definitions.                                |
| `headless/cli.ts`                 | Command-line parsing, configuration selection, and user-facing errors.            |
| `headless/apiCall.ts`             | Headless client calls into the backend API.                                       |
| `headless/configHandler.ts`       | YAML loading and experiment configuration validation.                             |

Not every feature needs a new layer. Keep small helpers close to their owning module, but do not combine HTTP parsing, provider calls, SQL, and experiment decisions in one route handler.

## Layering expectations

- Presentation layer: React components, dashboard state, CLI output, and API response shaping.
- API layer: Express routes, request validation, authentication or configuration checks, and HTTP errors.
- Logic layer: experiment runners, processors, evaluators, token estimation, workflows, and worker coordination.
- Provider layer: OpenAI, Google, Anthropic, Azure OpenAI, Bedrock, and other model adapters.
- Data layer: MySQL connection helpers, schema definitions, saved experiments, results, and run metadata.

Route handlers should collect HTTP inputs, call the logic layer, and return the result. Services and runners should own experiment decisions and orchestration. Database helpers should own SQL details. The headless client should translate CLI intent into API calls instead of duplicating backend logic.

## Boundary catalog

### API and execution

The Express app is the boundary for experiment execution. New dashboard or CLI behavior that affects saved experiments, run state, results, or persistence should be represented by an API operation so both clients observe the same rules.

Keep route handlers thin. They may parse requests and map errors to HTTP responses, but multi-step execution belongs in runners, services, or workers. Avoid opening a second database or execution path from the CLI.

### Configuration and file inputs

YAML configurations and supporting datasets are external inputs. `headless/configHandler.ts` and the corresponding backend validation should reject malformed or incompatible configurations before expensive provider calls begin. Preserve existing saved-experiment names and configuration formats unless a deliberate migration is documented and tested.

Example workflows and small public fixtures belong in `files/`. Private datasets, generated results, and large inputs belong outside version control.

### Providers and network access

Provider clients should remain behind small adapters or injectable collaborators. Provider request shaping, token estimation, retry behavior, and response normalization should be testable without a real model request. Tests must use mocked responses or fakes and must not depend on `credentials.json`.

Keep provider-specific behavior out of generic route handlers. This makes it possible to add or change a provider without changing the API contract or experiment orchestration.

### Persistence and run state

MySQL is the durable store for saved experiments and results. The API also maintains process-local run state for active execution and progress reporting. Code that relies on in-memory run state must account for process restarts; it must not treat that state as durable history.

Database schema changes belong in `backend/database/db.sql` and must be reflected in the affected queries, API behavior, and tests. Keep SQL and connection management in the database layer rather than embedding it in React components, CLI code, or route handlers.

### Frontend and headless clients

The frontend and headless runner are clients of the backend. Shared behavior such as configuration validation, token checks, provider selection, experiment execution, and persistence belongs behind the API. Client-specific concerns such as form state, progress presentation, terminal formatting, and argument parsing may remain in their respective clients.

## Execution flow

For a normal experiment run:

1. A dashboard action or CLI command selects a YAML configuration or saved experiment.
2. The client sends the request to the Express API.
3. The API validates configuration and estimates token usage before execution.
4. The runner loads required inputs, invokes processors and providers, and sends outputs to evaluators.
5. Workers report progress and run state while results are persisted through the backend database layer.
6. The API returns the result or exposes progress and completion data for the client.

Provider calls should happen only after local validation has succeeded. Errors should retain enough context for the API and CLI to report a useful failure without exposing credentials or sensitive prompt content unnecessarily.

## Static architecture checks

Architecture boundaries are protected primarily by focused tests in `backend/__test__/` and `tests/`:

- Backend tests cover API behavior, runner and worker execution, configuration handling, token estimation, and persistence-related behavior.
- CLI tests cover argument handling, saved-run selection, API calls, and user-facing failures.
- Provider-facing tests use mocks or injected fakes to prevent accidental network calls.

When adding a boundary, add a focused test that would fail if a caller bypassed it. Run the smallest relevant test first, then the full `npm test` and production build before opening a pull request.

## Runtime boundaries

Runtime state belongs outside source-controlled code:

- `credentials.json` and provider API keys
- MySQL databases and connection dumps
- uploaded files under `uploads/`
- generated experiment results and logs
- temporary worker state and local artifacts

Keep secrets out of YAML files, fixtures, logs, and error messages. Review changes for accidental credentials, private datasets, uploads, or generated files before committing.
