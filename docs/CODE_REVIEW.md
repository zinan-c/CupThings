# CupThings Code Review

Last reviewed: 2026-07-15
Reviewed revision: `a4c042d` (`feat: implement CupThings MVP`)

This document records review findings that should remain visible across agent sessions. It is a tracked project document, unlike the local `WORK_LOG.md`.

## Status conventions

- `Open`: confirmed issue or improvement that has not been addressed.
- `In progress`: currently being addressed by an agent.
- `Resolved`: implemented and verified; keep the entry with the resolving commit.
- Priorities run from `P1` (address before a shared MVP deployment) to `P3` (refinement).

## Open findings

### CR-001 — API `.env` files are not loaded automatically

- Status: Resolved
- Priority: P1
- Affected files:
  - `apps/api/package.json`
  - `apps/api/src/db/client.ts`
  - `apps/api/drizzle.config.ts`
  - `README.md`

The README tells developers to copy `apps/api/.env.example` to `apps/api/.env`, but the API starts with `tsx watch src/server.ts` and does not load that file. `db/client.ts` reads `process.env.DATABASE_URL` directly. Drizzle also reads the process environment directly and silently falls back to a local connection string.

This means copying the example file is not sufficient on a clean shell. It can also cause migrations to target the fallback database rather than the database named in `.env`.

Recommended resolution:

1. Load environment variables consistently for both the API runtime and Drizzle configuration, for example with `dotenv/config` or an explicit Node `--env-file` option.
2. Remove the implicit production-capable database fallback from `drizzle.config.ts`, or restrict it explicitly to local development.
3. Verify the documented setup from a clean shell where `DATABASE_URL` is not already exported.

Resolution:

- Added a small API env loader used by both the runtime database client and Drizzle config.
- Removed the implicit Drizzle database fallback; `DATABASE_URL` is now required.
- Verified Drizzle migration and API database client loading from `apps/api/.env` without an exported `DATABASE_URL`.
- Resolving commit: `f9a57db`.

### CR-002 — A runtime 401 leaves stale authenticated UI state

- Status: Resolved
- Priority: P2
- Affected files:
  - `apps/web/src/api.ts`
  - `apps/web/src/App.tsx`

When a request returns 401, the API client removes the token from `localStorage` and throws `AUTH_REQUIRED`. The in-memory `profile` state in `App` is not cleared, so authenticated screens remain mounted and subsequent requests continue failing until the page is refreshed.

Recommended resolution:

- Introduce a dedicated authentication error and handle it at the application boundary, or dispatch a centralized auth-required event that clears the profile and returns the user to the welcome screen.
- Add a test for a token that becomes invalid after initial profile loading.

Resolution:

- Added a dedicated `AuthRequiredError` and centralized auth-required browser event.
- `App` now clears in-memory profile state and returns to the welcome flow when any request receives 401.
- Resolving commit: `f9a57db`.

### CR-003 — Malformed CupThing IDs return 500

- Status: Resolved
- Priority: P2
- Affected files:
  - `apps/api/src/routes/cup-things.ts`
  - `packages/shared/src/index.ts`

The detail, update, and delete routes cast `request.params.id` to a string and pass it directly into a PostgreSQL UUID comparison. A value such as `not-a-uuid` raises a database syntax error and is reported as a 500 response.

Recommended resolution:

- Add a shared Zod schema for UUID route parameters.
- Parse all three `/:id` routes before querying PostgreSQL.
- Return a consistent 400 response for malformed IDs and retain 404 for valid but unknown UUIDs.

Resolution:

- Added shared UUID param schema.
- Detail, update, and delete routes now validate IDs before database queries.
- Added API coverage for malformed UUID returning 400 and cross-profile valid UUID returning 404.
- Resolving commit: `f9a57db`.

### CR-004 — Fresh-clone type checking depends on generated shared output

- Status: Resolved
- Priority: P2
- Affected files:
  - `package.json`
  - `packages/shared/package.json`
  - TypeScript workspace configuration

`@cupthings/shared` exports its types and JavaScript from `dist`, while the root `typecheck` command does not build the shared package first. The current workspace passes because ignored shared build output already exists; a clean clone may not.

Recommended resolution: choose one workspace-wide approach and verify it from a clean checkout:

- Build `@cupthings/shared` before recursive type checking; or
- Add TypeScript project references; or
- Use development path aliases that resolve shared source directly.

Resolution:

- Updated root `build`, `typecheck`, and `test` scripts to build shared output before dependent package checks.
- Verified workspace `typecheck` from the root script.
- Resolving commit: `f9a57db`.

### CR-005 — `test` scripts do not run tests

- Status: Resolved
- Priority: P2
- Affected files:
  - `package.json`
  - `apps/api/package.json`
  - `apps/web/package.json`
  - `packages/shared/package.json`

The current `test` scripts only run TypeScript. There are no test or spec files, so `pnpm test` can appear successful without verifying behavior.

Minimum recommended coverage:

- Anonymous profile creation and token hashing.
- Missing and invalid tokens.
- Isolation between two profiles.
- CupThing create, read, update, delete, and filtering.
- Rating range and half-step validation.
- Review date boundaries, category counts, and average rating.
- Malformed UUID handling.
- Frontend local-date-to-UTC conversion.

Resolution:

- Added Node test coverage for API profile creation, token hashing, missing/invalid tokens, profile isolation, CRUD, filtering, rating validation, Review stats, deletion, and malformed UUIDs.
- Added frontend date helper tests for whole-day ranges and datetime-local conversion.
- Updated package test scripts to run behavior tests.
- Resolving commit: `f9a57db`.

### CR-006 — Delete failures are not represented in the UI

- Status: Resolved
- Priority: P3
- Affected file: `apps/web/src/App.tsx`

The detail view awaits deletion without a `try/catch` or deleting state. A failed request produces an unhandled rejection and gives the user no recovery path.

Recommended resolution:

- Add a deleting state, disable repeated clicks, catch the failure, and render an actionable error.

Resolution:

- Detail view now tracks deleting state, disables repeated delete clicks, catches delete failures, and renders the error while preserving the detail view.
- Resolving commit: `f9a57db`.

### CR-007 — Record filter requests can resolve out of order

- Status: Resolved
- Priority: P3
- Affected file: `apps/web/src/App.tsx`

Changing filters quickly can create overlapping list requests. A slower old request can resolve after the newest request and overwrite the records with stale results.

Recommended resolution:

- Cancel obsolete requests with `AbortController`, or track a request generation ID and ignore stale responses.

Resolution:

- List filtering now uses `AbortController` plus an active request guard so obsolete responses cannot overwrite current list state.
- Resolving commit: `f9a57db`.

### CR-008 — Database rating constraints rely only on the API

- Status: Resolved
- Priority: P3
- Affected files:
  - `apps/api/src/db/schema.ts`
  - `apps/api/drizzle/0000_dark_synch.sql`

Zod validates ratings at the API boundary, but PostgreSQL does not enforce the equivalent `rating_half_steps` range. Invalid values can enter through manual SQL, later scripts, or future endpoints.

Recommended resolution:

- Add a nullable check constraint requiring `rating_half_steps` to be between 2 and 10.

Resolution:

- Added Drizzle schema check constraint and generated migration `0001_nappy_iron_fist.sql`.
- Applied migration locally and verified PostgreSQL rejects `rating_half_steps = 11` while leaving no temporary data.
- Resolving commit: `f9a57db`.

## Deferred refinements

These are reasonable MVP tradeoffs and do not need immediate changes:

- Navigation is held in React state, so refresh and browser Back do not preserve detail/edit views. Adopt URL routing when that behavior becomes important.
- Review statistics load the selected records and aggregate them in Node. Move aggregation to SQL when record volume or pagination requires it.
- Lists are not paginated. Add cursor pagination when real usage demonstrates the need.

## README improvements

The README should eventually include the following sections:

1. **Prerequisites** — supported Node version, pnpm version and installation method, and PostgreSQL requirements.
2. **Quick start from a clean clone** — database creation, environment setup, migrations, and startup commands.
3. **Environment variables** — `DATABASE_URL`, `PORT`, `WEB_ORIGIN`, and `VITE_API_URL`, including which process consumes each variable.
4. **Anonymous identity and data recovery** — explain that the token is browser-bound and that clearing browser storage or changing devices loses access in the MVP.
5. **API overview** — summarize `/profiles`, `/me`, `/cup-things`, and `/reviews` and the Bearer token requirement.
6. **Data model and validation** — categories, field limits, rating rules, and date semantics.
7. **Development commands** — dev, build, typecheck, test, migration generation, and migration execution.
8. **Current limitations** — no formal login, cross-device recovery, pagination, images, maps, social features, or AI narration.
9. **Project status** — distinguish implemented functionality, verified functionality, and planned work.

## Verification performed during review

- Shared TypeScript check passed.
- API TypeScript check passed.
- Web TypeScript check passed.
- Web production build passed.
- A separate runtime validation recorded in `WORK_LOG.md` confirmed migrations, profile creation, CupThing CRUD, filtered listing, Review statistics, deletion, and 404-after-delete behavior.
- Automated behavior tests now cover API and frontend date helpers.

## Verification performed during resolution

- Workspace `typecheck` passed.
- Workspace `test` passed against local PostgreSQL.
- Workspace `build` passed.
- Drizzle migration from `apps/api/.env` passed without exported `DATABASE_URL`.
- API database client runtime `.env` load check returned `{ ok: 1 }`.
- PostgreSQL rating check constraint rejected an invalid manual insert and left no temporary profile.

## Resolution workflow

When addressing a finding:

1. Change its status to `In progress` before implementation.
2. Add or update verification appropriate to the risk.
3. After verification, set the status to `Resolved` and record the resolving commit hash beneath the finding.
4. Do not delete resolved findings; keeping them preserves the engineering decision history.
