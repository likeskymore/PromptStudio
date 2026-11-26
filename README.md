# PromptStudio

PromptStudio is a local tool for designing, running, and evaluating prompts for large language models. Its execution pipeline combines an Express backend API with a headless runner that calls it.

> **Important:** PromptStudio is built to run and evaluate [ChainForge](https://github.com/ianarawjo/ChainForge) flows. Build your workflow in ChainForge, then export it as a YAML (`.yml`) file before running it with PromptStudio.

We also provide an installable dashboard for experiment monitoring, available [here](https://github.com/likeskymore/prompt-studio-dashboard)

## Key features

- Run YAML-exported ChainForge experiments
- Estimate input-token usage before execution.
- Save and rerun experiments.
- Persist experiments and results in MySQL.

## Requirements

- Node.js 20 or later
- npm
- MySQL
- API credentials for the providers used by your experiments

## Quick start

Install dependencies:

```bash
npm install
```

Create a MySQL database, then copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Set `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, and `DATABASE_NAME`, plus the provider keys used by your workflows (for example `OPENAI_API_KEY` and `PALM_API_KEY` for Google).

Start the backend in one terminal:

```bash
npx tsx backend/api/server.ts
```

_The frontend dashboard is optional. If you want to use it, run the frontend separately by following the instructions provided in the dashboard project's README._

The backend and frontend listen on ports `3001` and `3005`, respectively, by default.

## Run an experiment

Export your flow from [ChainForge](https://github.com/ianarawjo/ChainForge) in YAML format (`.yml`), place the exported configuration and its supporting files in `files/`, then run:

```bash
npx tsx headless/cli.ts --config files/YOUR_CONFIG_FILE.yml
```

To rerun a saved experiment:

```bash
npx tsx headless/cli.ts --name YOUR_EXPERIMENT_NAME
```

The runner estimates input-token usage and asks for confirmation before execution.

## Documentation

### For users

- [Getting started](docs/getting-started.md): install PromptStudio and run a first experiment.
- [Experiment workflows](docs/experiments.md): datasets, YAML configuration, CLI usage, providers, and troubleshooting.

### For developers

- [Developer guide](docs/developer-guide.md): setup, repository layout, development workflow, testing, and contribution baseline.
- [Architecture](docs/architecture.md): repository layout, runtime responsibilities, and module boundaries.
- [Database](docs/database.md): MySQL backend behavior, schema responsibilities, and generated schema artifacts.
- [Testing and quality](docs/testing.md): test commands, quality checks, and provider mocking.
- [Contributing](docs/contributing.md): pull request and documentation expectations.

## Security

Keep `.env`, database credentials, API keys, private datasets, and generated outputs out of version control. Use provider keys with appropriate access and spending limits.

## License

This project is licensed under the GNU Lesser General Public License v2.1 only. See [LICENSE](LICENSE) for the full license text.

Unless a file states otherwise, source files in this repository are distributed under `LGPL-2.1` only.
