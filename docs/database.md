# Database

PromptStudio uses MySQL as its durable application database. The schema is defined in [backend/database/db.sql](../backend/database/db.sql), and runtime access is implemented by the query and persistence helpers in [backend/database/database.ts](../backend/database/database.ts). The database stores experiment definitions, workflow nodes, model settings, datasets, execution results, evaluation output, processor output, errors, and persisted experiment-run snapshots.

The optional React dashboard and the headless runner both use the backend API. They should not connect to MySQL directly or implement a second persistence path.

## Database connection

The backend reads database credentials from the repository-root `credentials.json` file when [backend/database/database.ts](../backend/database/database.ts) is loaded. The expected `database` object contains the MySQL host, user, password, database name, and optional port. Keep this file local and outside version control.

The backend creates one `mysql2/promise` connection pool with these operational defaults:

- MySQL port `3306` when no port is configured.
- Up to 10 active connections.
- Queued requests when all connections are busy.
- Up to 10 idle connections with a 60-second idle timeout.
- UTC connection timezone.

Persistence helpers accept either the shared pool or an explicit MySQL connection. Pass an explicit connection when several related writes must share a transaction boundary. Keep SQL in the database helpers rather than embedding queries in route handlers, CLI code, or the separate frontend repository.

## Creating the database

For a new local database, run the schema script with a MySQL client using an account that can create databases:

```bash
mysql -u YOUR_USER -p < backend/database/db.sql
```

The script creates and selects the `promptstudio` database before creating tables and views. If the database already exists, remove or comment out the `CREATE DATABASE promptstudio` statement and run only the schema statements that are appropriate for the target environment. The schema script is an initialization script, not a migration history.

Start the backend after `credentials.json` points at the configured database:

```bash
npx tsx backend/api/server.ts
```

Use a disposable database for tests and local experiments. Do not point automated tests at a shared or production database.

## Data model overview

PromptStudio stores a workflow as an `Experiment` containing typed `Node` records and directed `Link` records. Node-specific tables hold the definition for prompt templates, datasets, processors, and evaluators. An experiment is expanded into one or more `PromptConfig` records that select a model, model parameters, prompt template, and final dataset. Inputs are resolved from datasets, and each configuration produces results, errors, processor output, and evaluation output.

Use the [interactive PromptStudio database schema](promptStudioDbDiagram.html) for the complete table, column, relationship, index, and constraint reference. It provides searchable navigation and visual relationship details; this guide focuses on database behavior, ownership, and update workflow.

## Workflow definition tables

### `Experiment`

Stores a saved experiment definition and its execution defaults.

- `id`: Unsigned auto-incrementing primary key.
- `title`: Required unique experiment name used by the headless runner and API lookups.
- `datetime`: Creation timestamp with microsecond precision.
- `total_requests`: Request count associated with the experiment definition.
- `max_retry`: Non-negative retry limit.
- `threads`: Worker parallelism setting, defaulting to one.

### `Node`

Stores the graph nodes that make up an experiment.

- `id`: Primary key referenced by typed node tables.
- `type`: One of `prompt_template`, `processor`, `evaluator`, or `dataset`.
- `experiment_id`: Parent experiment. Deleting the experiment cascades to its nodes.
- `name`: Node name, unique within an experiment.

### `Link`

Stores directed edges between nodes.

- `source_node_id` and `target_node_id`: The connected nodes.
- `source_var` and `target_var`: Optional variable names used to map node values.
- The composite primary key includes the target variable, allowing separate variable mappings while preventing duplicate links.
- A check constraint prevents a node from linking to itself.

### `PromptTemplate`

Stores prompt text and its iteration count for a prompt-template node. Its `node_id` is both the primary key and a foreign key to `Node`, so the row cannot exist without the corresponding typed node.

### `Dataset`, `Marker`, `Marker_value`, `Data_Input`, `Resolved_input`, and `Input_marker`

These tables normalize tabular experiment inputs:

- `Dataset` names a dataset node.
- `Marker` defines a column or variable for a dataset.
- `Marker_value` stores distinct values for a marker. The SHA-256-style `hash` column is unique to support value deduplication.
- `Data_Input` represents one input row and may contain an `oracle` value used by evaluations.
- `Input_marker` associates input rows with marker values through a many-to-many join.
- `Resolved_input` stores a derived input value linked to its source input.

The dataset loader in `backend/database/database.ts` reads CSV rows, creates input rows, reuses existing marker values by hash, and records the input-to-marker associations. Deleting a dataset cascades to its markers, values, inputs, resolved inputs, and join rows.

## Model and evaluation configuration

### `Llm`

Stores reusable model identities.

- `base_model`: Unique provider/model family identifier.
- `name`: Display name.
- `model`: Provider-specific model identifier.

### `Llm_param` and `Llm_custom_param`

`Llm_param` stores standard model controls such as `temperature`, `max_tokens`, `top_p`, `top_k`, `stop_sequence`, `frequency_penalty`, and `presence_penalty`. Database checks constrain numeric settings to their supported ranges. Provider-specific settings are stored as name/value rows in `Llm_custom_param`, keyed by `(name, llm_param_id)`.

### `Evaluator`

Stores the common definition for an evaluator node.

- `type`: `simple`, `javascript`, `python`, `llm`, or `multieval`.
- `code`: Optional evaluator implementation for code-based evaluators.
- `name`: Display name.
- `return_type`: `string`, `number`, or `boolean`.

The following tables provide evaluator-specific data:

- `Llm_evaluator` connects an evaluator to an `Llm` and `Llm_param`, and stores its format, prompt, and pre-scoring explanation setting.
- `Simple_evaluator` stores the comparison text and optional selected variable metadata.
- `Multi_evaluator` maps a parent evaluator to child evaluators.

### `Processor`

Stores processor-node definitions. `type` is one of `join`, `split`, `javascript`, or `python`; code, formatting, selected group variables, and display name are stored with the node.

## Configuration and execution artifacts

### `PromptConfig`

Represents one executable combination within an experiment:

- the parent `experiment_id`;
- the selected `LLM_id` and `LLM_param_id`;
- the prompt template node;
- an optional final dataset node.

A unique constraint prevents the same experiment, model, parameter, template, and final-dataset combination from being stored more than once. The foreign keys preserve the relationship between a saved experiment and its executable configurations.

### `Result` and `Error`

`Result` stores successful output for a prompt configuration and input, along with start/end timestamps and optional total token usage. `Error` stores a failed configuration/input attempt, error message, numeric error code, and timing information. Both tables cascade when their parent prompt configuration or input is removed.

### `ProcessorResult` and `Processor_error`

These tables store processor output and processor failures. A processor result may be associated with a completed `Result`, a raw `Data_Input`, or a `Resolved_input`; a check constraint requires at least one result or input reference. Unique constraints prevent duplicate output for the same result/processor pair or processor/resolved-input pair.

### `EvaluationsResult` and `Error_evaluator`

`EvaluationsResult` stores evaluator output associated with a result or input and an evaluator node. `Error_evaluator` records evaluator failures and can point to the result and/or input involved. Evaluator rows are removed when the referenced evaluator, result, or input is deleted.

## Experiment run history

### `Experiment_run`

`Experiment_run` stores a durable snapshot of a run identified by a UUID-style `run_id`. It complements, rather than replaces, process-local worker state in the backend.

- `experiment_id` and `experiment_name`: The experiment being run and its name snapshot.
- `status`: `queued`, `running`, `paused`, `completed`, or `failed`.
- `created_at`, `started_at`, `paused_at`, `finished_at`, and `updated_at`: Lifecycle timestamps.
- `total_paused_ms`: Accumulated paused duration.
- `total_tasks`, `attempts`, `completed`, `failed`, and `retries`: Progress counters.
- `total_tokens`: Token usage accumulated by the run.
- `last_error`: Latest run-level failure detail.
- `total_latency_ms`, `latency_count`, `p50_latency_ms`, `p95_latency_ms`, and `p99_latency_ms`: Latency statistics.
- `samples`: JSON summary or sample data associated with the run.

The run state module periodically upserts snapshots through the database helpers. On process restart, the database retains the last persisted state, but active worker objects and in-memory execution context do not become durable automatically. Resume and monitoring behavior must therefore use the API's persisted run-state logic rather than assuming the worker process survived.

## Views

The schema defines read-oriented views for common queries:

- `View_Result_By_Template` joins results to their prompt template through `PromptConfig`.
- `View_Input_Marker_Values` presents input rows with marker names and values instead of exposing the join tables directly.
- `View_Nodes_Without_Parents` returns experiment nodes that have no incoming link from another node in the same experiment.

These views are query conveniences. The base tables in `db.sql` remain the schema source of truth.

## Integrity and deletion rules

The schema uses unsigned numeric identifiers, primary keys, unique constraints, foreign keys, enum columns, check constraints, and indexes to protect workflow integrity.

Most child rows use `ON DELETE CASCADE`. Deleting an experiment therefore removes its nodes, configurations, inputs, results, and related execution artifacts. Deleting a node removes its typed definition and dependent links. Be especially careful with destructive operations: the database does not provide an application-level recycle bin.

Use parameterized SQL through `mysql2` placeholders. Do not interpolate experiment names, node IDs, model settings, file content, or user-controlled values into query strings.

## Updating the schema

When changing tables, columns, constraints, indexes, views, or relationships:

1. Update [backend/database/db.sql](../backend/database/db.sql), keeping naming and foreign-key conventions consistent.
2. Update the related TypeScript types in [backend/api/types.ts](../backend/api/types.ts).
3. Update or add persistence helpers in [backend/database/database.ts](../backend/database/database.ts).
4. Update API, runner, CLI, and integration behavior that reads or writes the changed data.
5. Add focused tests for the new query or behavior, including cascade and uniqueness behavior when relevant.
6. Apply the schema to a disposable MySQL database and verify representative create, read, update, and delete flows.
7. Update this guide and [promptStudioDbDiagram.html](promptStudioDbDiagram.html) when the conceptual model changes.

`db.sql` is currently the schema initialization script rather than a versioned migration system. For a deployed database, plan any change as an explicit migration: preserve existing data, apply compatible changes in order, and verify foreign keys and indexes before rolling out code that depends on them.

## Runtime data and security

Keep the following out of source control:

- `credentials.json`, passwords, and provider keys;
- database dumps and production exports;
- private datasets and prompt content;
- generated model outputs, logs, and temporary run artifacts.

Database rows can contain prompts, dataset values, model outputs, and evaluation details. Treat backups, SQL dumps, and diagnostic queries as sensitive data. Redact credentials and private prompt or dataset content from logs and bug reports.
