## ReLiS Project Structure

```text
relis/
├─ apps/
│  ├─ web/                                  # Next.js App Router frontend.
│  │  ├─ public/                            # Static assets served directly.
│  │  └─ src/
│  │     ├─ app/                            # Next.js routes.
│  │     │  └─ [locale]/                    # /en, /fr localized routes.
│  │     │     ├─ layout.tsx
│  │     │     ├─ page.tsx
│  │     │     ├─ login/
│  │     │     ├─ projects/
│  │     │     │  └─ [projectId]/           # Explicit active project context.
│  │     │     │     ├─ papers/
│  │     │     │     ├─ screening/
│  │     │     │     ├─ quality-assessment/
│  │     │     │     ├─ data-extraction/
│  │     │     │     └─ reporting/
│  │     │     └─ admin/
│  │     ├─ features/                       # Frontend feature modules.
│  │     │  ├─ auth/
│  │     │  ├─ users/
│  │     │  ├─ projects/
│  │     │  ├─ papers/
│  │     │  ├─ imports/
│  │     │  ├─ screening/
│  │     │  ├─ quality-assessment/
│  │     │  ├─ data-extraction/
│  │     │  ├─ reporting/
│  │     │  └─ admin/
│  │     ├─ shared/                         # Shared frontend primitives.
│  │     │  ├─ ui/
│  │     │  ├─ forms/
│  │     │  ├─ table/
│  │     │  ├─ charts/
│  │     │  ├─ hooks/
│  │     │  └─ lib/
│  │     └─ i18n/                           # Static English/French translations.
│  │        └─ dictionaries/
│  │           ├─ en.json
│  │           └─ fr.json
│  │
│  ├─ api/                                  # Hono/Express backend API.
│  │  └─ src/
│  │     ├─ main.ts                         # API entry point.
│  │     ├─ app.ts                          # API app assembly.
│  │     ├─ platform/                       # Backend foundation layer.
│  │     │  ├─ http/                        # Middleware, routing setup, responses.
│  │     │  ├─ config/                      # Runtime env config.
│  │     │  ├─ database/                    # Control DB Prisma client.
│  │     │  ├─ project-context/             # Resolves projectId, membership, role.
│  │     │  ├─ project-database/            # Per-project DB resolver/provisioner.
│  │     │  ├─ auth/                        # Sessions, tokens, passwords.
│  │     │  ├─ access-control/              # Permissions and policies.
│  │     │  ├─ i18n/                        # Locale and localized error codes.
│  │     │  ├─ audit/                       # Audit logs.
│  │     │  ├─ undo/                        # Undoable operations.
│  │     │  ├─ events/                      # Internal domain events.
│  │     │  ├─ jobs/                        # Queue abstraction.
│  │     │  ├─ storage/                     # Files, uploads, exports.
│  │     │  ├─ mail/                        # Email abstraction.
│  │     │  ├─ observability/               # Logging, metrics, tracing.
│  │     │  └─ errors/                      # Typed errors.
│  │     └─ modules/                        # Isolated ReLiS business modules.
│  │        ├─ installation/
│  │        ├─ identity/
│  │        ├─ users/
│  │        ├─ projects/
│  │        ├─ system-settings/
│  │        ├─ translations/
│  │        ├─ papers/
│  │        ├─ imports/
│  │        ├─ review-workflow/
│  │        ├─ screening/
│  │        ├─ quality-assessment/
│  │        ├─ data-extraction/
│  │        ├─ reporting/
│  │        └─ admin/
│  │
│  └─ worker/                               # Background job runtime.
│     └─ src/
│        ├─ main.ts
│        ├─ platform/                       # Worker-safe platform services.
│        │  ├─ config/
│        │  ├─ database/
│        │  ├─ project-database/
│        │  ├─ jobs/
│        │  ├─ storage/
│        │  └─ observability/
│        └─ jobs/
│           ├─ provision-project-db.job.ts
│           ├─ migrate-project-db.job.ts
│           ├─ backup-project-db.job.ts
│           ├─ import-papers.job.ts
│           ├─ detect-duplicates.job.ts
│           ├─ export-report.job.ts
│           ├─ compute-statistics.job.ts
│           └─ cleanup-temp-files.job.ts
│
├─ packages/
│  ├─ database/
│  │  └─ prisma/
│  │     ├─ control/                        # Global/control database schema.
│  │     │  ├─ schema.prisma
│  │     │  └─ migrations/
│  │     └─ project/                        # Schema applied to every project DB.
│  │        ├─ schema.prisma
│  │        └─ migrations/
│  ├─ contracts/                            # Shared Zod/API contracts.
│  ├─ ui/                                   # Optional shared design system.
│  ├─ config/                               # Shared TS/ESLint/app config.
│  └─ test-utils/                           # Shared testing helpers.
│
├─ docker/
│  ├─ web/
│  │  └─ Dockerfile
│  ├─ api/
│  │  └─ Dockerfile
│  ├─ worker/
│  │  └─ Dockerfile
│  ├─ postgres/
│  │  └─ init/
│  ├─ nginx/
│  │  └─ nginx.conf
│  └─ mailhog/
│
├─ docs/
│  ├─ architecture/
│  ├─ adr/
│  ├─ feature-map/
│  ├─ database/
│  └─ migration-notes/
│
├─ tests/
│  ├─ e2e/
│  ├─ integration/
│  ├─ migration/
│  └─ fixtures/
│
├─ tooling/
│  ├─ lint/
│  ├─ scripts/
│  └─ generators/
│
├─ storage/
│  ├─ uploads/
│  ├─ exports/
│  └─ temp/
│
├─ .env.example
├─ docker-compose.yml
├─ docker-compose.dev.yml
├─ docker-compose.test.yml
├─ eslint.config.mjs
├─ prettier.config.mjs
├─ tsconfig.base.json
├─ package.json
├─ pnpm-workspace.yaml
└─ README.md
```