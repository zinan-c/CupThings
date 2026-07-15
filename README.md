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

## Local Setup

1. Install dependencies with `pnpm install`.
2. Copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL`.
3. Copy `apps/web/.env.example` to `apps/web/.env` if the API URL differs from `http://localhost:4000`.
4. Run database migrations with `pnpm --filter @cupthings/api db:migrate`.
5. Start both apps with `pnpm dev`.

The Web app defaults to `http://localhost:5173`; the API defaults to `http://localhost:4000`.
