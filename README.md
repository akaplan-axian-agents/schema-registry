# JSON Schema Registry

A small Express website for hosting and managing JSON Schemas with Handlebars templates.

The browser receives HTML and CSS only. There is no browser JavaScript.

HTML is rendered server-side with `express-handlebars` templates in `views/`.

HTML display text is translated server-side with `i18next`,
`i18next-http-middleware`, and `i18next-fs-backend`. Translation files live in
`locales/{language}/translation.yml`. HTML routes use the standard
`Accept-Language` header, or a `Language` header when `Accept-Language` is not
present, and fall back to `en-US`.

## Run

```sh
cd schema-registry
npm start
```

Then open:

- Human catalog: `http://127.0.0.1:8080/catalog/`
- Hosted schema index: `http://127.0.0.1:8080/hosted/schemas/index.json`
- Hosted schema example: `http://127.0.0.1:8080/hosted/schemas/customer.schema.json`

## Configuration

Runtime configuration is loaded with `dotenv`, then read from environment
variables. Existing environment variables take precedence over values in
`.env`.

Copy `.env.example` to `.env` and adjust:

```text
HOST=127.0.0.1
PORT=8080
SCHEMA_ROOT=./schemas
STATIC_ROOT=./src/static
VIEWS_ROOT=./views
LOCALES_ROOT=./locales
```

## Container

Build the production container image from the repository root:

```sh
npm ci
npm run build
docker build -t schema-registry:local .
```

Run it with a writable schema data directory:

```sh
docker run --rm -p 8080:8080 -v "$PWD/schemas:/data/schemas" schema-registry:local
```

The container runs the minified server bundle with `node dist/server.js`, binds
to `0.0.0.0:8080`, and uses `/data/schemas` for persisted schema files.

## Azure Deployment

Terraform configuration for Azure Container Apps lives in
`infra/terraform/`. It provisions Azure Container Registry, Container Apps,
Log Analytics, managed identity access to pull from the registry, and Azure
Files storage mounted at `/data/schemas`.

See `infra/terraform/README.md` for the full deployment flow.

## Storage

Schemas start in `schemas/` as local files. The app depends on the
store contract used by the Express app in `src/app.js`, so a later database, object store, or
git-backed implementation can replace `FileSystemSchemaStore` in
`src/storage.js` without changing the route layer.

## Routes

- `GET /catalog/` lists schemas for humans.
- `GET /catalog/{id}/` shows schema metadata and JSON.
- `GET /hosted/schemas/index.json` lists machine-readable hosted schemas.
- `GET /hosted/schemas/{id}.schema.json` serves a schema with
  `application/schema+json`.
- `GET /manage/new` and `POST /manage/new` create schemas.
- `GET /manage/{id}/edit` and `POST /manage/{id}/edit` update schemas.
- `POST /manage/{id}/delete` deletes schemas.

## Test

```sh
npm test
```

## Coverage

```sh
npm run coverage
```

The coverage script uses Node's built-in test runner coverage report and
enforces high line, branch, and function coverage thresholds for `src/**/*.js`.

## Mutation Testing

```sh
npm run mutation
```

Mutation testing uses Stryker with the Node test runner's TAP output to check
whether existing unit tests fail when application source code is changed by
small generated mutations. The Stryker configuration mutates `src/**/*.js`,
excluding the runtime `src/server.js` entrypoint, and writes HTML reports under
`reports/`. The current mutation score gate is 75%.

## CI Checks

Source-modifying tools are grouped separately from inspect-only tools.

```sh
npm run fix:source
npm run check:source
npm run check:inspect
npm run typecheck
npm run verify
```

`npm run fix:source` runs Prettier and Knip fixes. `npm run check:source`
checks those tools without modifying files. `npm run check:inspect` runs
ESLint, TypeScript type checking from JSDoc, npm audit, and Secretlint.
`npm run verify` runs source checks, inspect-only checks, coverage, and
mutation testing.

In GitHub Actions, the Tests workflow first runs source fixes on same-repository
branches. If that step changes files, it commits the changes back to the branch
and skips validation in the current run so the next workflow run validates the
updated commit.

## Versioning

The project version is maintained in `package.json` and `package-lock.json`.
The `main` branch HEAD carries the version number for the next merge. Branches
created from `main` inherit that pending version, so a pull request merge commit
already contains the version it will release.

When a pull request is merged into `main`, the Version Bump GitHub Actions
workflow tags that merge commit with the version already present in
`package.json`, then commits the next patch version back to `main` for the next
branch.

To keep the pending version correct, do not merge stale pull request branches
into `main`. The repository uses GitHub merge queue for pull requests targeting
`main`, so GitHub queues pull requests against the latest base branch before
merging them. The Tests workflow includes the `merge_group` trigger needed if
required merge-queue checks are added later. Direct post-merge pushes from the
Version Bump workflow are not routed through the queue, so `main` can advance to
the next pending version.
