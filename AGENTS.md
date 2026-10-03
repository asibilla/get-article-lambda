# AGENTS.md

Guidance for AI coding agents working in this repository.

## Overview

A small AWS SAM serverless app written in TypeScript. It exposes a REST API (API Gateway) backed by Lambda functions that read and write article content in a single DynamoDB table.

There are three Lambda functions, all defined in `template.yml`:

| Function | Source | Purpose |
| --- | --- | --- |
| `GetArticle` | `src/app.ts` | `GET` articles, either by id or as a paginated list by type |
| `WriteArticle` | `src/write-app.ts` | `PUT` / `PATCH` / `DELETE` article items |
| `AuthorizerFunction` | `src/authorizer.ts` | API Gateway request authorizer for the default-protected routes |

Shared helpers live in `src/util/`:

- `cors.ts`: origin allow-listing, CORS headers, cache-control headers, `OPTIONS` handling
- `dynamodb.ts`: DynamoDB document client and `getTableName()`
- `response.ts`: `jsonResponse()` helper that applies CORS and optional cache headers

## Tech stack

- Node.js Lambda runtime (see `template.yml` Globals), TypeScript with `strict` on
- AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`)
- AWS SAM (`sam build`) with esbuild as the bundler, configured per function under `Metadata` in `template.yml`
- Yarn 4 (`packageManager` in `package.json`) with the `node-modules` linker
- CI/CD build is described in `buildspec.yml` (AWS CodeBuild)

## Commands

```bash
yarn install            # install dependencies
yarn build              # sam build (bundles each function with esbuild)
npx tsc --noEmit        # type-check (there is no dedicated script)
yarn invoke:local       # sam local invoke the GetArticle function
yarn invoke:local:authorizer
yarn generate:mock      # generate a sample API Gateway event into mocks/
```

Notes:

- `mocks/` and `.aws-sam/` are git-ignored. Local mock events and env files are developer-local and must not be committed.
- There is currently no test suite or lint script. If you add tests or linting, add matching `package.json` scripts and document them here.

## Architecture notes

### Read path (`src/app.ts`)

- Query param `id` set: queries the table by `article-id` and returns the matching items, or 404 if none.
- `id` not set: queries the `article-type` index for the given `type`, newest first, with a page size of 20, projecting only a few attributes.
- Pagination uses an opaque base64url `cursor` query param that encodes DynamoDB's `LastEvaluatedKey`. The cursor is decoded and validated as a JSON object; invalid cursors return 400.

### Write path (`src/write-app.ts`)

- `PUT` body: `{ "item": {...} }`
- `PATCH` body: `{ "key": {...}, "updates": {...} }` (builds a `SET` update expression using placeholder names/values)
- `DELETE` body: `{ "key": {...} }`
- Validation errors are thrown with messages starting with `Request body`, which the handler maps to a 400. Keep that prefix convention if you add new validation errors, or update the status-code mapping.

### Responses and CORS

- Always build responses through `jsonResponse()` so CORS and cache headers stay consistent.
- Allowed origins come from the `ALLOWED_ORIGINS` environment variable (comma-separated). Origins not in the list get no CORS headers, and `OPTIONS` preflight returns 403.
- Cache headers are only added when `cacheControl: true` is passed and the origin is allowed. Localhost origins get no-cache headers.

### Infrastructure (`template.yml`)

- Function names, table name, domain, and allowed origins are exposed as template `Parameters` with defaults; prefer changing parameters over hardcoding values in code.
- Lambda IAM policies are scoped to the minimum DynamoDB actions each function needs. Keep them least-privilege when adding features (e.g. don't grant write actions to the read function).
- Routes are under `/api/...`. Each route that is called from a browser needs a matching `OPTIONS` event with no authorizer so CORS preflight works.
- When adding a new Lambda, add a `Metadata` block (esbuild, `EntryPoints`) like the existing functions.

## Conventions

- TypeScript, 4-space indentation in `src/app.ts`, `src/authorizer.ts`, `src/write-app.ts`, `src/util/cors.ts`, and `src/util/response.ts`. Match the style of the file you are editing.
- Use `import type` for type-only imports where practical.
- Handlers are exported as `lambdaHandler`; the `Handler` value in `template.yml` is `<file>.lambdaHandler`.
- Read configuration from environment variables via small helpers (like `getTableName()`), and fail with a clear error if a required value is missing.
- Catch errors in handlers and return them through `jsonResponse()` with an appropriate status code instead of letting the Lambda crash.
- Keep the bundle small: avoid adding heavy dependencies; the AWS SDK v3 clients are already available.

## Security and public-repo rules

This repository is public. When making changes:

- Never commit secrets, tokens, credentials, API keys, account IDs, private ARNs, or real environment values.
- Never commit contents of `mocks/` or any `.env`-style file.
- Pass secrets to Lambdas via parameters or environment variables defined in `template.yml`; do not hardcode them in source.
- Do not log secrets, authorization headers, or full request bodies.
- Do not weaken authorization, CORS allow-listing, or IAM policies without an explicit request from the maintainer.
- Do not add documentation or comments that describe sensitive infrastructure details (internal endpoints, credential locations, or how protections could be bypassed).

## Before finishing a change

1. Type-check with `npx tsc --noEmit`.
2. Run `yarn build` if you changed `template.yml`, dependencies, or entry points.
3. Confirm `git status` shows no secrets, mock files, or build output (`.aws-sam/`) staged.
