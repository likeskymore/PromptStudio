# Architecture

PromptStudio is organized into three cooperating parts:

- The React frontend authors workflows and presents experiment results.
- The Express backend owns API behavior, persistence, provider requests, and experiment execution.
- The headless runner invokes the backend API for repeatable command-line runs.

## Repository layout

```text
backend/    API routes, model integrations, database access, and experiment services
files/      Example YAML workflows, datasets, processors, and evaluators
headless/   Command-line experiment runner and backend client
tests/      Jest tests for backend, CLI, and configuration behavior
doc/        Existing project notes and technical documentation
```

## Boundaries

Keep HTTP concerns in the API layer, experiment orchestration in backend services, and SQL in database or query helpers. The CLI should reuse backend endpoints rather than create a second persistence path.

Provider clients should remain behind small integrations so tests can inject fakes and avoid real network requests. Follow the patterns in neighboring modules before adding a new abstraction or dependency.

## Runtime data

Local credentials, databases, uploads, logs, and generated outputs are runtime data. Keep them out of version control and avoid placing secrets in experiment files.
