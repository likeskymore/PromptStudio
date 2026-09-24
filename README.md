# PromptStudio

PromptStudio is a local tool for designing, running, and evaluating prompts for large language models. Its execution pipeline combines an Express backend API with a headless runner that calls it.

We also provide an installable dashboard for experiment monitoring, available [here](https://github.com/likeskymore/prompt-studio-dashboard)

Experiment configurations can be imported from [ChainForge](https://github.com/ianarawjo/ChainForge)-compatible YAML files.

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

Create a MySQL database and configure `credentials.json` in the project root:

```json
{
  "database": {
    "host": "localhost",
    "user": "root",
    "password": "your_password",
    "database": "promptstudio",
    "port": 3306
  },
  "api_keys": {
    "OpenAI": "your_openai_api_key",
    "Google": "your_google_api_key"
  }
}
```

Start the backend in one terminal:

```bash
npx tsx backend/api/server.ts
```

*The frontend dashboard is optional. If you want to use it, run the frontend separately by following the instructions provided in the dashboard project's README.*

The backend and frontend listen on ports `3001` and `3005`, respectively, by default.

## Run an experiment

Place a YAML configuration and its supporting files in `files/`, then run:

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

Keep `credentials.json`, database credentials, API keys, private datasets, and generated outputs out of version control. Use provider keys with appropriate access and spending limits.

## License

This project is licensed under the GNU Lesser General Public License v2.1 only. See [LICENSE](LICENSE) for the full license text.

Unless a file states otherwise, source files in this repository are distributed under `LGPL-2.1` only.
