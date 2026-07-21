# CupThings Code Review

Last reviewed: 2026-07-18
Latest reviewed revision: `18be3f2` (`fix: address latest code review findings`)
Initial reviewed revision: `a4c042d` (`feat: implement CupThings MVP`)

## Refactor follow-up 2026-07-21

- `d2cd813` separates authentication and Review transactions from route handlers, extracts the Web HTTP client, rating, records, and feedback modules, and centralizes API test helpers.
- `47685b7` adds Magic Link expiry/replay, refresh replay, and anonymous account merge coverage.
- `86eb8e8` adds idempotent API shutdown for SIGTERM and SIGINT.
- `a529b5f` adds Web API client coverage for Bearer/Cookie requests, refresh retry, storage failures, and auth invalidation.

Remaining test gaps are component-level browser interaction tests and Playwright end-to-end coverage for the full MVP workflow.

This document records review findings that should remain visible across agent sessions. It is a tracked project document, unlike the local `WORK_LOG.md`.

## Status conventions

- `Open`: confirmed issue or improvement that has not been addressed.
- `In progress`: currently being addressed by an agent.
- `Resolved`: implemented and verified; keep the entry with the resolving commit.
- Priorities run from `P1` (address before a shared MVP deployment) to `P3` (refinement).

## Historical findings

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

## Review 2026-07-18 — Resolved findings

### CR-009 — Transient startup failures erase the anonymous recovery token

- Status: Resolved
- Priority: P1
- Affected files:
  - `apps/web/src/App.tsx`
  - `apps/web/src/api.ts`

The startup `getMe()` call clears the stored token for every rejected request. This includes 401, but also temporary API downtime, CORS failures, database failures, offline state, browser `Load failed`, and 500 responses.

The anonymous token is the user's only credential. Clearing it after a recoverable failure can permanently orphan all records associated with that profile.

Recommended resolution:

1. Clear the token only for `AuthRequiredError` or another confirmed 401 response.
2. Preserve the token for network, CORS, timeout, and server errors.
3. Add a distinct startup error state with Retry rather than returning to onboarding.
4. Add tests proving that network and 500 failures do not clear the token.

Resolution:

- Startup now distinguishes confirmed 401 responses from network/server failures, preserves the token for recoverable failures, and renders a Retry state.
- Resolving commit: `18be3f2`.

### CR-010 — The rating UI exposes an invalid 0.5 value

- Status: Resolved
- Priority: P1
- Affected files:
  - `apps/web/src/App.tsx`
  - `packages/shared/src/index.ts`
  - `apps/api/src/db/schema.ts`

`StarRatingInput` generates `[rating - 0.5, rating]` for every star. The first star therefore exposes a 0.5 choice, while the shared schema and database only accept ratings from 1 through 5. Selecting the first star's left half creates UI state that cannot be saved and produces a 400 response.

Recommended resolution:

- Under the current product rule, expose only 1.0 for the first star and half/integer choices for later stars.
- If 0.5 is intended to be valid, update the shared schema, database constraint, README, and tests together.
- Add a UI-level test covering every selectable rating value.

Resolution:

- The first star exposes only 1.0; later stars expose half and whole values. The selectable value helper is covered by Web tests.
- Resolving commit: `18be3f2`.

### CR-011 — Development host exposure conflicts with the single CORS origin

- Status: Resolved
- Priority: P2
- Affected files:
  - `apps/api/src/app.ts`
  - `apps/web/package.json`
  - `apps/web/src/api.ts`
  - `README.md`

Vite runs with `--host 0.0.0.0`, which exposes localhost, 127.0.0.1, and LAN URLs. The API allows only one exact `WEB_ORIGIN`, normally `http://localhost:5173`, while the frontend defaults to `http://localhost:4000`.

Opening the app through 127.0.0.1 or a LAN address is therefore blocked by CORS. On another device, `localhost:4000` points to that device rather than the development machine. Browsers typically surface this as `Load failed` or `Failed to fetch`.

Recommended resolution:

- Prefer a same-origin Vite `/api` proxy for local development; or
- Support an explicit development origin allowlist and document LAN API configuration.
- Add a browser-level check for localhost, 127.0.0.1, and the intended LAN workflow.

Resolution:

- Vite now proxies same-origin `/api` requests and listens on all interfaces. API CORS accepts a comma-separated `WEB_ORIGINS` allowlist, with localhost and 127.0.0.1 defaults documented for direct access.
- Resolving commit: `18be3f2`.

### CR-012 — Browser storage failures can create inaccessible profiles

- Status: Resolved
- Priority: P2
- Affected files:
  - `apps/web/src/api.ts`
  - `apps/web/src/App.tsx`

The frontend accesses `localStorage` without error handling. During onboarding, the profile is created before the returned token is stored. If storage is unavailable due to privacy settings, browser policy, or a storage exception, the profile exists but its token is lost; retrying creates another orphan profile.

Recommended resolution:

1. Wrap application storage access in a small adapter.
2. Verify storage availability before `POST /profiles`.
3. Show a clear browser-storage requirement when persistence is unavailable.
4. Never use `localStorage.clear()`; remove only namespaced CupThings keys when necessary.

Resolution:

- Added a guarded namespaced storage adapter and availability probe before profile creation. Storage failures are shown as an actionable onboarding error, and only the CupThings token key is removed.
- Resolving commit: `18be3f2`.

### CR-013 — Review requests can resolve out of order

- Status: Resolved
- Priority: P2
- Affected files:
  - `apps/web/src/App.tsx`
  - `apps/web/src/api.ts`

Home list filtering cancels obsolete requests, but Review does not. Repeated Review clicks can leave multiple requests in flight; a slower response for an older category or date range can overwrite the newest result.

Recommended resolution:

- Apply the existing `AbortController` and active-request pattern to Review.
- Disable repeated submission while a request is pending, or explicitly replace the current request.
- Associate displayed results with the filters that produced them.

Resolution:

- Review requests now abort the previous request, ignore stale responses, and disable duplicate submission while loading.
- Resolving commit: `18be3f2`.

### CR-014 — API behavior tests use the normal database connection

- Status: Resolved
- Priority: P2
- Affected files:
  - `apps/api/src/api.test.ts`
  - `apps/api/src/db/client.ts`
  - `apps/api/.env.example`
  - `README.md`

API tests use the same `DATABASE_URL` as the development or deployed runtime. The tests currently clean up their generated profiles, but a misconfigured environment could run data-writing tests against a production database. An interrupted test can also leave temporary rows behind.

Recommended resolution:

- Require a separate `TEST_DATABASE_URL` for API tests.
- Refuse to start tests unless the database or schema is explicitly marked as test-only.
- Prefer transaction rollback or a dedicated temporary schema.
- Document test database setup.

Resolution:

- API tests require `TEST_DATABASE_URL`, load `.env.test`, and refuse databases whose names do not end in `_test`. README and env examples document the separate test database.
- Resolving commit: `18be3f2`.

### CR-015 — Network errors are exposed as browser-specific raw messages

- Status: Resolved
- Priority: P3
- Affected files:
  - `apps/web/src/api.ts`
  - `apps/web/src/App.tsx`
  - `apps/api/src/app.ts`

The fetch wrapper does not translate network failures, enforce a timeout, or explicitly opt API requests out of caching. Users see browser-specific messages such as `Load failed` or `Failed to fetch`, which do not distinguish API downtime, CORS, offline state, or timeout.

Recommended resolution:

- Add a dedicated `NetworkError` with an actionable user-facing message.
- Add a bounded timeout with `AbortController`.
- Set `cache: "no-store"` for private API requests and return an appropriate `Cache-Control` header from the API.
- Offer manual retry for safe reads; do not blindly retry non-idempotent creates.

Resolution:

- Fetch now uses a bounded timeout, translates transport failures to a stable NetworkError, opts out of caching, and exposes retry for startup reads. Creates are not automatically retried.
- Resolving commit: `18be3f2`.

### CR-016 — The health endpoint does not represent database readiness

- Status: Resolved
- Priority: P3
- Affected files:
  - `apps/api/src/app.ts`
  - `apps/api/src/db/client.ts`

`GET /health` always returns `{ ok: true }` even if PostgreSQL is unreachable. A deployment can therefore appear healthy while all useful endpoints fail.

Recommended resolution:

- Keep `/health` as a lightweight process liveness endpoint.
- Add `/ready` that performs a small database check such as `select 1`.
- Use readiness rather than liveness for deployment traffic routing.

Resolution:

- Added `/ready` with a `select 1` database check and `503` failure response. `/health` remains the lightweight liveness endpoint.
- Resolving commit: `18be3f2`.

### Additional test gaps

The current automated checks do not cover:

- The rating control's complete selectable value set.
- Startup network and server failures preserving the anonymous token.
- Browser storage exceptions.
- CORS behavior across localhost, 127.0.0.1, and LAN access.
- Review request cancellation and response ordering.
- End-to-end onboarding, record editing, and Review interactions.
- Daylight-saving-time boundaries for local date helpers.

The datetime-local round-trip test should compare the final ISO instant with the original input instant. Its current assertion mostly compares two values derived from the same intermediate local string, so it does not strongly validate the complete round trip.

### Verification for the 2026-07-18 review

- Git worktree was clean and `main` matched `origin/main` at `1bc2478`.
- Shared, API, and Web TypeScript checks passed.
- API behavior tests passed: 3 tests.
- Web date helper tests passed: 2 tests.
- Shared, API, and Web production builds passed.
- Test execution did not change the existing database row counts.

## Deferred refinements

These are reasonable MVP tradeoffs and do not need immediate changes:

- Navigation is held in React state, so refresh and browser Back do not preserve detail/edit views. Adopt URL routing when that behavior becomes important.
- Review statistics load the selected records and aggregate them in Node. Move aggregation to SQL when record volume or pagination requires it.
- Lists are not paginated. Add cursor pagination when real usage demonstrates the need.
- Split the large `apps/web/src/App.tsx` into profile, records, form, Review, and rating feature modules.
- Optional text field limits and frontend `maxLength` hints were added on 2026-07-21 in `7bd6368`.
- Use one source for category constants shared by API schema and domain validation.
- Add linting, formatting, and CI checks for typecheck, test, and build.
- Add graceful API shutdown that closes Fastify and the PostgreSQL pool.
- Profile creation rate limiting was added on 2026-07-21 in `7bd6368`.
- Configure production caching explicitly for `index.html`, hashed assets, and private API responses.

## README improvements

The setup, environment, API, identity, validation, command, limitation, troubleshooting, test database, and readiness sections requested by the review are now present:

1. `Load failed` troubleshooting distinguishes API downtime, CORS, an incorrect `VITE_API_URL`, and unavailable browser storage.
2. Supported Node and pnpm versions are documented.
3. The separate test database setup proposed in CR-014 is documented.
4. `/ready` and its database readiness behavior are documented.

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
