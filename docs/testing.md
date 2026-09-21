# Testing and Quality

PromptStudio uses Jest for backend, CLI, and configuration tests. Provider integrations should be tested with mocked responses or injected fakes; automated tests should not call real model APIs.

## Commands

```bash
npm test      # Format, lint, and run Jest
npm run build # Format, lint, and create a production build
npm run clean # Format and lint only
```

Run focused tests while developing, then run `npm test` and `npm run build` before opening a pull request.

## Test coverage expectations

Add regression coverage for changes to:

- Experiment and YAML parsing
- Token estimation
- API behavior and persistence
- Provider request shaping
- Headless CLI behavior

Prefer the narrowest useful test layer. Keep secrets, private datasets, local databases, uploads, logs, and generated outputs out of the repository.
