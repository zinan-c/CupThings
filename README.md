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
4. Copy `apps/web/.env.example` to `apps/web/.env` if the API URL differs from `http://localhost:4000`.
5. Run database migrations with `pnpm --filter @cupthings/api db:migrate`.
6. Start both apps with `pnpm dev`.

The Web app defaults to `http://localhost:5173`; the API defaults to `http://localhost:4000`.

## Environment Variables

- `DATABASE_URL`: consumed by the API runtime and Drizzle migrations.
- `PORT`: optional API port, default `4000`.
- `WEB_ORIGIN`: optional CORS origin, default `http://localhost:5173`.
- `VITE_API_URL`: optional frontend API base URL, default `http://localhost:4000`.

The API and Drizzle config load `apps/api/.env` automatically when commands are run from `apps/api` or through the provided pnpm scripts.

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

Categories are fixed to `coffee`, `wine`, `dessert`, and `other`. `name`, `category`, and `consumedAt` are required. `rating` is optional and supports 1 to 5 in 0.5 increments. Review and filter ranges use inclusive start and end instants supplied by the Web app from local date selections.

## Development Commands

- `pnpm dev`: build shared schemas, then start API and Web dev servers.
- `pnpm build`: build shared output, API, and Web production assets.
- `pnpm typecheck`: run workspace TypeScript checks after building shared output.
- `pnpm test`: run behavior tests.
- `pnpm --filter @cupthings/api db:generate`: generate Drizzle migrations.
- `pnpm --filter @cupthings/api db:migrate`: apply Drizzle migrations.

## Current Limitations

The MVP does not include formal login, cross-device recovery, pagination, image upload, maps, social features, native mobile apps, WeChat mini program support, or AI narration.
