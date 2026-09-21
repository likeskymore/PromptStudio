# Experiment Workflows

PromptStudio supports interactive browser workflows and repeatable command-line runs.

## File organization

Keep related files together under `files/`:

```text
files/
  experiment.yml
  dataset.csv
  processor.js
  evaluator.js
```

YAML configurations define the workflow. CSV files provide input rows. Processors transform inputs or responses, and evaluators score or compare model outputs. Prefer relative paths so workflows can be moved between installations.

## Run from the command line

To save and run a new experiment:

```bash
npx tsx headless/cli.ts --config files/YOUR_CONFIG_FILE.yml
```

To rerun an experiment already saved in the database:

```bash
npx tsx headless/cli.ts --name YOUR_EXPERIMENT_NAME
```

The runner requires `credentials.json` and a running backend API. It estimates input-token usage and asks for confirmation before sending provider requests.

## Providers and privacy

PromptStudio supports integrations including OpenAI, Google, Anthropic, Azure OpenAI, and Amazon Bedrock. Configure only the providers needed by your workflows.

Do not place passwords, private customer data, or API keys in datasets, YAML files, processors, evaluators, screenshots, or committed generated output. Use provider keys with appropriate access and spending limits.

## Troubleshooting

- Confirm the backend is running when the browser cannot load data.
- Check the configured API port when frontend requests fail.
- Review the token estimate and dataset size before confirming a costly run.
- Check YAML syntax and referenced file paths when a workflow fails to load.
