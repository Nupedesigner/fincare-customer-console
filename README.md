# FinCare Customer Console

**FinCare Customer Console** is a full-stack, multi-tenant administration platform for financial-service customers to configure, test, govern, and monitor a FinCare AI environment. It separates inbound customer financial-system connections from outbound developer resources, keeps Sandbox and Production records distinct, and provides audited, role-controlled configuration workflows.

> **Non-production notice.** The current project contains demonstration configuration and workflow data. It is not a production banking system and must not be used to process real customer credentials, account data, or payment instructions.

## Contents

| Section | Purpose |
| --- | --- |
| [Product scope](#product-scope) | Explains the console’s customer-facing operational model. |
| [Architecture](#architecture) | Describes the client, API, database, and identity layers. |
| [Local setup](#local-setup) | Provides the steps required to run the project locally. |
| [Database and migrations](#database-and-migrations) | Covers schema review and safe migration practice. |
| [Testing and automation](#testing-and-automation) | Documents automated verification and deployment preparation. |
| [Security model](#security-model) | Summarizes tenant isolation, roles, API-key handling, and logging. |
| [Private repository access](#private-repository-access) | Explains how to share this private repository safely. |

## Product scope

The console is organized around the customer operations lifecycle rather than a generic dashboard. The **Dashboard** combines an operational overview—welcome context, quick actions, AI state, support metrics, and setup progress—with the current environment-health indicators. The remainder of the console is structured as follows.

| Area | Primary capabilities |
| --- | --- |
| **Integrations** | Connect, configure, test, and monitor customer-provided core banking, account, transaction, loan, card, payment, and custom financial APIs. |
| **Developers** | Manage applications, secure one-time API keys, OAuth clients, SDK settings, webhooks, sandbox tools, documentation, and API logs. |
| **AI Platform** | Configure the FinCare AI agent, capabilities, system prompt, and controlled test experience. |
| **Knowledge and Rules** | Maintain governed knowledge resources and operational, compliance, workflow, or AI rules. |
| **Monitoring and Security** | Review integration health, alerts, audit activity, role-scoped controls, credential ownership records, and security events. |
| **Organization and Settings** | Manage customer membership roles and environment-specific General, Developer, API, Environment, and Notification settings. |

Every operational record is scoped to the authenticated customer tenant and either **Sandbox** or **Production**. The selected environment is visible across the console so configuration, credentials, logs, and controls cannot be mixed accidentally.

## Architecture

The application uses a typed client-to-server contract. The React client calls protected tRPC procedures; the Express server applies tenant and role checks; Drizzle maps the approved schema to MySQL/TiDB. This makes authorization part of the server boundary rather than a client-only UI convention.

```text
React 19 + Tailwind 4
        │ typed tRPC calls
        ▼
Express 4 + tRPC 11 router
        │ protected procedures, tenant and role checks
        ▼
Drizzle ORM + MySQL/TiDB
        │
        ├── tenant configuration and audit events
        ├── environment-scoped integrations and developer resources
        └── user preferences and sign-in activity
```

| Layer | Main responsibility | Important locations |
| --- | --- | --- |
| Client | FinCare-branded console shell, workspaces, forms, responsive UX, and typed query/mutation handling. | `client/src/pages/`, `client/src/index.css` |
| Server | Protected tRPC procedures, FinCare-managed demo session, role enforcement, and audit logging. | `server/routers.ts`, `server/routers/bankPortal.ts`, `server/db.ts` |
| Shared model | Tenant slug normalization and application-wide shared types. | `shared/` |
| Persistence | MySQL/TiDB schema and reviewed Drizzle migrations. | `drizzle/schema.ts`, `drizzle/` |
| Verification | Vitest coverage for auth, tenant context, roles, environment isolation, profile security, and console control flows. | `server/**/*.test.ts` |

### Authentication and authorization

The browser presents a FinCare/Qorebank-branded access experience. The current non-production workflow supports a managed demo session for demonstration and testing, rather than presenting a Manus-branded sign-in or sign-up page. Protected server procedures identify the authenticated user, resolve their active customer bank environment, and then enforce role permissions.

Supported customer roles include `bank_owner`, `organization_admin`, `bank_admin`, `ai_manager`, `integration_manager`, `support_manager`, `support_agent`, `analyst`, and `compliance_officer`. An end user must never be permitted to self-create a customer organization; customer environments are provisioned through FinCare administration.

## Local setup

### Prerequisites

Use **Node.js 22** and **pnpm 10.4.1**. The project uses pnpm’s lockfile for repeatable dependency resolution. GitHub’s CI workflow uses the same runtime and package-manager versions.[1] [2]

| Requirement | Why it is needed |
| --- | --- |
| Node.js 22 | Runs the Vite client build, TypeScript checks, and Express server bundle. |
| pnpm 10.4.1 | Installs the locked JavaScript dependencies. |
| MySQL/TiDB database | Stores tenant, integration, audit, profile-security, and configuration data. |
| Environment variables | Supplies database access, session signing, OAuth/platform values, and host configuration. |

### Installation

```bash
git clone https://github.com/Nupedesigner/fincare-customer-console.git
cd fincare-customer-console
pnpm install --frozen-lockfile
```

Create local environment configuration through your approved secret-management method. **Do not commit `.env` files, database URLs, JWT secrets, OAuth client secrets, deployment-hook tokens, or production credentials.** The server expects platform- or host-provided values such as the following.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL/TiDB connection string. |
| `JWT_SECRET` | Server-side session signing secret. |
| `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID` | Managed identity and callback configuration where enabled by the host. |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Host-provided server-side platform services, including storage or approved built-in services. |
| `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` | Host-provided frontend service configuration. |

Start the local development server:

```bash
pnpm dev
```

Run the standard verification commands before opening a pull request:

```bash
pnpm check
pnpm test
pnpm build
```

The production server bundle is launched with `pnpm start` after a successful `pnpm build`.

## Database and migrations

The Drizzle schema is the source of truth for model changes. Schema changes should be handled in the order below so TypeScript contracts, migration files, and the database remain aligned.

1. Update `drizzle/schema.ts`.
2. Generate a migration with `pnpm drizzle-kit generate`.
3. Review the generated SQL for destructive changes, ownership, and environment-scoping correctness.
4. Apply the reviewed migration through the approved database migration process.
5. Add or update query helpers, router procedures, UI calls, and Vitest coverage.

Never use a migration to seed invented customer reviews, ratings, testimonials, real credentials, or production financial data. File bytes also belong in object storage, not relational database fields; store authorized file metadata and object references in the database instead.

## Testing and automation

### Continuous integration

`.github/workflows/ci.yml` runs automatically for every pull request targeting `main`, every push to `main`, and manual workflow dispatch. It installs locked dependencies, runs `pnpm check`, runs all Vitest regression tests, builds the production bundle, and retains the `dist/` deployment package for fourteen days. GitHub Actions workflows are event-driven YAML files stored in `.github/workflows`.[1]

### Deployment preparation

`.github/workflows/deploy.yml` is intentionally **manual**. It requires an explicit Sandbox or Production selection, reruns the type check, tests, and production build, then invokes an approved external deployment webhook. Configure the secret through GitHub **Settings → Environments** for each target environment:

| GitHub Environment secret | Required | Purpose |
| --- | --- | --- |
| `DEPLOY_WEBHOOK_URL` | Yes | HTTPS endpoint of the approved deployment provider or internal deployment service. |
| `DEPLOY_WEBHOOK_TOKEN` | Recommended | Bearer token accepted by that endpoint. Keep it scoped and rotate it through the provider. |

Use GitHub Environment protection rules, required reviewers, and separate Sandbox/Production secrets before enabling the Production run. GitHub environments can apply deployment protection rules and environment-specific secrets.[3]

> **Manus-hosted deployments:** this repository workflow verifies release readiness. The current hosting workflow must still be published through the project’s **Publish** control; do not invent or configure an unverified external deploy webhook for Manus hosting. If you later move to an external platform, configure that platform’s documented webhook as `DEPLOY_WEBHOOK_URL`.

## Security model

The project is designed around controlled customer operations, not unbounded self-service banking functionality.

| Control | Current implementation |
| --- | --- |
| Customer isolation | Database records are resolved through active customer membership and server-side bank context. |
| Environment separation | Integrations, administration records, API keys, and settings are separated by `sandbox` or `production`. |
| Authorization | Protected tRPC procedures enforce role requirements before reads or mutations. |
| Auditability | Key configuration, security, role, integration, profile, and settings actions write tenant audit events. |
| API keys | Keys are generated once, returned only at issuance, and persisted as a hash and ending rather than plaintext. |
| Security controls | Secret ownership and rotation are recorded as governance metadata; plaintext secrets are explicitly excluded. |
| Repository hygiene | GitHub workflow secrets and application environment values are never committed to the repository. |

## Repository workflow

Use feature branches and pull requests for code changes. The CI workflow protects the quality gate, but repository branch protection should require the **Verify Console / Type-check, test, and build** status check before merge.

```bash
git checkout -b feature/short-description
# make and verify changes
pnpm check && pnpm test && pnpm build
git add <files>
git commit -m "feat: concise change description"
git push -u origin feature/short-description
```

## Private repository access

The repository is **private**. Sharing its URL does **not** give another person access. Invite a collaborator from the repository’s **Settings → Collaborators and teams** page, or transfer/use the repository within a GitHub organization and grant a team the appropriate role. Private repositories are visible only to people or teams that have been granted access.[4]

Use the least privilege necessary: **Read** for reviewers, **Triage** for issue managers, **Write** for contributors, **Maintain** for repository operations, and **Admin** only for trusted owners. Do not share personal access tokens, session cookies, database URLs, or deployment-hook secrets in chat, source files, or issues.

## References

[1]: https://docs.github.com/actions/writing-workflows "GitHub Actions: writing workflows"
[2]: https://github.com/pnpm/action-setup "pnpm/action-setup"
[3]: https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment "GitHub Actions environments"
[4]: https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility "GitHub repository visibility"
