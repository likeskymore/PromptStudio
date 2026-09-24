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

*The frontend dashboard is optional. If you want to use it, run the frontend separately by following the instructions provided in the dashboard project's README.*

The backend and frontend listen on ports `3001` and `3005`, respectively, by default.

## Create your first experiment

1. Create or export a ChainForge-compatible YAML configuration.
2. Place the YAML file and supporting files in `files/`.
3. Open the frontend and author or import the workflow.
4. Run the experiment and inspect its outputs and evaluations.

See [Experiment workflows](experiments.md) for file organization and CLI usage.
