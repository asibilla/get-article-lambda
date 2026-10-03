# get-article-lambda

A small AWS SAM serverless app, written in TypeScript, that serves and manages article content stored in DynamoDB through an API Gateway REST API.

## Features

- **Read articles** by id, or list articles by type with cursor-based pagination.
- **Write articles** (create/replace, partial update, delete) through a separate, access-controlled endpoint.
- **CORS handling** with an environment-configured origin allow-list.
- **Request authorizer** protecting the API's default routes.

## Project structure

```
src/
  app.ts          # GetArticle Lambda (read)
  write-app.ts    # WriteArticle Lambda (create/update/delete)
  authorizer.ts   # API Gateway request authorizer
  util/
    cors.ts       # Origin allow-list, CORS and cache headers, OPTIONS handling
    dynamodb.ts   # DynamoDB document client and table name helper
    response.ts   # JSON response helper
template.yml      # SAM template (API, functions, IAM policies)
buildspec.yml     # CodeBuild build/package spec
```

## Prerequisites

- Node.js (matching the Lambda runtime in `template.yml`)
- [Yarn 4](https://yarnpkg.com/) (via Corepack: `corepack enable`)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- AWS credentials configured locally if you want to run against real AWS resources

## Getting started

```bash
yarn install
yarn build        # sam build, bundles each function with esbuild
npx tsc --noEmit  # type-check
```

## API

All routes live under `/api`.

### `GET /api/get-article`

| Query param | Description |
| --- | --- |
| `id` | Return the item(s) with this article id. Returns `404` if none are found. |
| `type` | When `id` is omitted, list articles of this type, newest first (20 per page). |
| `cursor` | Opaque pagination token from a previous response's `nextCursor`. Only used when listing by type. An invalid cursor returns `400`. |

Example response when listing by type:

```json
{
  "response": {
    "items": [{ "article-id": "...", "article-type": "...", "date": "...", "displayTitle": "..." }],
    "nextCursor": "..."
  }
}
```

`nextCursor` is only present when more results are available.

### `PUT | PATCH | DELETE /api/write-article`

Requires IAM-signed requests. The body is JSON:

| Method | Body |
| --- | --- |
| `PUT` | `{ "item": { ... } }` |
| `PATCH` | `{ "key": { ... }, "updates": { ... } }` |
| `DELETE` | `{ "key": { ... } }` |

Invalid bodies return `400`; unexpected errors return `500`.

## Configuration

Runtime configuration is provided through environment variables, which `template.yml` sets from stack parameters:

| Variable | Used by | Description |
| --- | --- | --- |
| `ARTICLE_TABLE_NAME` | `GetArticle`, `WriteArticle` | DynamoDB table name |
| `ALLOWED_ORIGINS` | `GetArticle`, `WriteArticle` | Comma-separated list of origins allowed by CORS |

Requests from origins not in `ALLOWED_ORIGINS` receive no CORS headers, and preflight requests from them are rejected.

## Local development

Local invocation uses SAM with mock events and environment files kept in a git-ignored `mocks/` directory:

```bash
yarn generate:mock          # generate a sample GET event into mocks/event.json
yarn invoke:local           # invoke GetArticle with mocks/event.json and mocks/env.json
yarn invoke:local:authorizer
```

You need to create `mocks/env.json` yourself (see the [SAM docs on environment variable files](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-using-invoke.html)). Do not commit anything in `mocks/`.

## Deployment

`buildspec.yml` builds the app with `sam build` and packages it with `sam package` to an S3 artifact bucket supplied through the build environment. The resulting packaged template is then deployed with CloudFormation.

## Contributing

See [AGENTS.md](./AGENTS.md) for architecture notes, coding conventions, and guidelines (including security considerations for this public repository).
