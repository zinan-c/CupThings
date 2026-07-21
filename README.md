# CupThings

CupThings is a lightweight Web app for logging personal drink and food experiences such as coffee, wine, desserts, and other similar moments.

## MVP Scope

- Anonymous browser-bound profile created after the user submits a display name.
- CupThing create, list, detail, edit, and delete.
- Category and date-range filtering.
- Review for a selected date range with records, total count, category counts, and average rating.
- No formal login, images, maps, social features, AI narration, or cross-device recovery in the MVP.

## Workspace

- `apps/web`: React, TypeScript, Vite frontend.
- `apps/api`: Node.js, TypeScript, Fastify REST API.
- `packages/shared`: Zod schemas and shared TypeScript types.

## Prerequisites

- Node.js 22 or newer.
- pnpm 9.x.
- PostgreSQL 16 or another compatible PostgreSQL server.

## Quick Start

1. Install dependencies with `pnpm install`.
2. Create a local database, for example `createdb cupthings`.
3. Copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL`.
4. Copy `apps/web/.env.example` to `apps/web/.env` only when the API is not reachable through the local Vite proxy.
5. Run database migrations with `pnpm --filter @cupthings/api db:migrate`.
6. Start both apps with `pnpm dev`.

The Web app defaults to `http://localhost:5173` and proxies `/api` to the API at `http://localhost:4000`. The Vite server listens on all interfaces, so another device can use the host machine's LAN address without a browser CORS request. For a direct API URL, set `VITE_API_URL` and include the Web origin in `WEB_ORIGINS`.

## Environment Variables

- `DATABASE_URL`: consumed by the API runtime and Drizzle migrations.
- `PORT`: optional API port, default `4000`.
- `WEB_ORIGINS`: optional comma-separated CORS origins for direct API access. Defaults to localhost and 127.0.0.1 Web origins. `WEB_ORIGIN` remains supported for a single origin.
- `VITE_API_URL`: optional frontend API base URL, default `/api` (the Vite development proxy).
- `TEST_DATABASE_URL`: required for API tests when `NODE_ENV=test`; it must point to a database whose name ends in `_test`.
- `TRUST_PROXY`: set to `true` only when the API runs behind a trusted reverse proxy, so profile creation rate limiting can use the original client IP.

The API and Drizzle config load `apps/api/.env` automatically when commands are run from `apps/api` or through the provided pnpm scripts.

For API tests, create a separate test database and copy `apps/api/.env.example` to `apps/api/.env.test`, keeping only a `TEST_DATABASE_URL` that ends in `_test`. Tests refuse to use the normal runtime database.

## Identity and Recovery

MVP identity is anonymous and browser-bound. After the user submits a display name, the API returns a token and the Web app stores it in browser storage. Clearing browser storage or changing devices loses access to that MVP profile.

## API Overview

- `POST /profiles`: create an anonymous profile and return a Bearer token.
- `GET /me`: return the current profile.
- `POST /cup-things`: create a record.
- `GET /cup-things`: list records, optionally filtered by `category`, `from`, and `to`.
- `GET /cup-things/:id`: fetch one record.
- `PATCH /cup-things/:id`: update one record.
- `DELETE /cup-things/:id`: delete one record.
- `GET /reviews`: return records and simple stats for a date range, optionally filtered by `category`.

All endpoints except `POST /profiles` require `Authorization: Bearer <token>`.

## Data Model and Validation

Categories are fixed to `coffee`, `wine`, `dessert`, and `other`. `name`, `category`, and `consumedAt` are required. `rating` is optional and supports 1 to 5 in 0.5 increments. `displayName` and `name` are limited to 80 and 120 characters; `location` and `style` to 120; `notes` to 2,000; and flavors to 20 values of 40 characters each. API requests are limited to 32 KB, and profile creation is limited to 5 attempts per IP per minute. Review and filter ranges use inclusive start and end instants supplied by the Web app from local date selections.

## Development Commands

- `pnpm dev`: build shared schemas, then start API and Web dev servers.
- `pnpm build`: build shared output, API, and Web production assets.
- `pnpm typecheck`: run workspace TypeScript checks after building shared output.
- `pnpm test`: run behavior tests.
- `pnpm --filter @cupthings/api db:generate`: generate Drizzle migrations.
- `pnpm --filter @cupthings/api db:migrate`: apply Drizzle migrations.
- `CUPTHINGS_BACKUP_DIR=/var/backups/cupthings ./scripts/backup-postgres.sh`: create and retain a PostgreSQL backup.

`GET /health` reports process liveness. `GET /ready` checks PostgreSQL readiness and returns `503` when the database is unavailable.

## Troubleshooting

If the browser shows a network error, first check that the API is running on port `4000` and that `/ready` returns success. When using a direct `VITE_API_URL`, make sure the URL points to the development machine rather than `localhost` on another device, and add the Web origin to `WEB_ORIGINS`. Site storage must be enabled because it holds the anonymous profile token.

Database backup and restore procedures are documented in [`docs/DATABASE_BACKUP.md`](docs/DATABASE_BACKUP.md). Recovery token export/import is intentionally deferred for now.

## Current Limitations

The MVP does not include formal login, cross-device recovery, pagination, image upload, maps, social features, native mobile apps, WeChat mini program support, or AI narration.
