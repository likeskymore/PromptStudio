# PromptStudio

PromptStudio is a local tool for engineering, running, and evaluating prompts for large language models. It combines a React workspace, an Express API, and a headless experiment runner for testing prompts against structured datasets.

Experiment configurations can be imported from ChainForge-compatible YAML files. Supported integrations include OpenAI, Google, Anthropic, Azure OpenAI, and Amazon Bedrock.

## Key features

- Build and compare prompt workflows.
- Run experiments against CSV datasets.
- Add custom processors and evaluators.
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

Start the frontend in another:

```bash
npm start
```

The API uses port `3001` by default, and the frontend development server normally uses port `3000`.

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

- [User guide](docs/user-guide.md): overview of the user documentation.
- [Getting started](docs/getting-started.md): install PromptStudio and run a first experiment.
- [Experiment workflows](docs/experiments.md): datasets, YAML configuration, CLI usage, providers, and troubleshooting.

### For developers

- [Developer guide](docs/developer-guide.md): overview of the developer documentation.
- [Architecture](docs/architecture.md): repository layout, runtime responsibilities, and module boundaries.
- [Testing and quality](docs/testing.md): test commands, quality checks, and provider mocking.
- [Contributing](docs/contributing.md): pull request and documentation expectations.

## Development commands

```bash
npm test      # Format, lint, and run Jest
npm run build # Format, lint, and create a production build
npm run clean # Format and lint only
```

## Security

Keep `credentials.json`, database credentials, API keys, private datasets, and generated outputs out of version control. Use provider keys with appropriate access and spending limits.

## License

This project is licensed under the GNU Lesser General Public License v2.1 only. See [LICENSE](LICENSE) for the full license text.

Unless a file states otherwise, source files in this repository are distributed under `LGPL-2.1` only.
