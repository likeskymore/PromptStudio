# Getting Started

This walkthrough takes a new PromptStudio user from installation to the first experiment.

## Install

Requirements:

- Node.js 20 or later
- npm
- MySQL
- API credentials for the providers used by your experiments

From the repository root:

```bash
npm install
```

Create a MySQL database and add `credentials.json` to the project root. Keep this file out of version control.

## Start PromptStudio

Run the backend in one terminal:

```bash
npx tsx backend/api/server.ts
```

Run the frontend in another:

```bash
npm start
```

The backend listens on port `3001` by default. The frontend development server normally uses port `3000`.

## Create your first experiment

1. Prepare a CSV dataset.
2. Create or export a ChainForge-compatible YAML configuration.
3. Place the YAML file and supporting files in `files/`.
4. Open the frontend and author or import the workflow.
5. Run the experiment and inspect its outputs and evaluations.

See [Experiment workflows](experiments.md) for file organization and CLI usage.
