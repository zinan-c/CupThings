import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { buildApp } from "./app.js";
import { db, pool } from "./db/client.js";
import { accounts, cupThings, loginChallenges, profiles, sessions } from "./db/schema.js";
import { getLastConsoleLoginLink } from "./email.js";
import { auth, cookieHeader, createTestProfile } from "./test-helpers.js";

const app = await buildApp();
const createdProfileIds: string[] = [];
const createdAccountIds: string[] = [];

after(async () => {
  for (const id of createdProfileIds) {
    await db.delete(profiles).where(eq(profiles.id, id));
  }
  for (const id of createdAccountIds) {
    await db.delete(accounts).where(eq(accounts.id, id));
  }
  await app.close();
  await pool.end();
});

test("profile creation returns a token and hashes it at rest", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/profiles",
    payload: { displayName: "Test Profile Hash" }
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  createdProfileIds.push(body.profile.id);
  assert.equal(body.profile.displayName, "Test Profile Hash");
  assert.equal(typeof body.token, "string");

  const [row] = await db.select().from(profiles).where(eq(profiles.id, body.profile.id));
  assert.ok(row);
  assert.ok(row);
  const [session] = await db.select().from(sessions).where(eq(sessions.profileId, body.profile.id));
  assert.ok(session);
  assert.notEqual(session.accessTokenHash, body.token);
  assert.equal(typeof body.refreshToken, "string");
});

test("missing and invalid tokens are rejected", async () => {
  const missing = await app.inject({ method: "GET", url: "/me" });
  assert.equal(missing.statusCode, 401);

  const invalid = await app.inject({
    method: "GET",
    url: "/me",
    headers: { authorization: "Bearer invalid-token" }
  });
  assert.equal(invalid.statusCode, 401);
});

test("Magic Link claims an anonymous profile, rotates sessions, and logs out", async () => {
  const anonymous = await createTestProfile(app, createdProfileIds, "Magic Link Anonymous");
  const requestLink = await app.inject({
    method: "POST",
    url: "/auth/request-link",
    headers: auth(anonymous.token),
    payload: { email: "magic@example.com" }
  });
  assert.equal(requestLink.statusCode, 202);

  const link = getLastConsoleLoginLink();
  assert.ok(link);
  const challengeToken = new URL(link).searchParams.get("token");
  assert.ok(challengeToken);

  const verified = await app.inject({
    method: "POST",
    url: "/auth/verify",
    payload: { token: challengeToken }
  });
  assert.equal(verified.statusCode, 200);
  const verifiedBody = verified.json();
  assert.equal(verifiedBody.profile.id, anonymous.profile.id);
  assert.equal(typeof verifiedBody.refreshToken, "string");

  const [claimed] = await db.select().from(profiles).where(eq(profiles.id, anonymous.profile.id));
  assert.ok(claimed?.accountId);
  createdAccountIds.push(claimed.accountId);

  const cookies = cookieHeader(verified.headers["set-cookie"]);
  const me = await app.inject({ method: "GET", url: "/me", headers: { cookie: cookies } });
  assert.equal(me.statusCode, 200);

  const refreshed = await app.inject({ method: "POST", url: "/auth/refresh", headers: { cookie: cookies }, payload: {} });
  assert.equal(refreshed.statusCode, 200);
  const refreshedCookies = cookieHeader(refreshed.headers["set-cookie"]);
  const oldAccess = await app.inject({ method: "GET", url: "/me", headers: { authorization: `Bearer ${verifiedBody.token}` } });
  assert.equal(oldAccess.statusCode, 401);

  const logout = await app.inject({ method: "POST", url: "/auth/logout", headers: { cookie: refreshedCookies } });
  assert.equal(logout.statusCode, 204);
  const afterLogout = await app.inject({ method: "GET", url: "/me", headers: { cookie: refreshedCookies } });
  assert.equal(afterLogout.statusCode, 401);

  const replay = await app.inject({ method: "POST", url: "/auth/verify", payload: { token: challengeToken } });
  assert.equal(replay.statusCode, 401);
});

test("account deletion removes the profile, records, and account", async () => {
  const anonymous = await createTestProfile(app, createdProfileIds, "Delete Me");
  const requestLink = await app.inject({
    method: "POST",
    url: "/auth/request-link",
    headers: auth(anonymous.token),
    payload: { email: "delete@example.com" }
  });
  assert.equal(requestLink.statusCode, 202);
  const link = getLastConsoleLoginLink();
  assert.ok(link);
  const token = new URL(link).searchParams.get("token");
  assert.ok(token);

  const verified = await app.inject({ method: "POST", url: "/auth/verify", payload: { token } });
  assert.equal(verified.statusCode, 200);
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, anonymous.profile.id));
  assert.ok(profile?.accountId);
  createdAccountIds.push(profile.accountId);

  const deleted = await app.inject({
    method: "DELETE",
    url: "/account",
    headers: { cookie: cookieHeader(verified.headers["set-cookie"]) }
  });
  assert.equal(deleted.statusCode, 204);
  const [deletedProfile] = await db.select().from(profiles).where(eq(profiles.id, anonymous.profile.id));
  assert.equal(deletedProfile, undefined);
  const [deletedAccount] = await db.select().from(accounts).where(eq(accounts.id, profile.accountId));
  assert.equal(deletedAccount, undefined);
});

test("refresh rotation rejects replayed refresh tokens", async () => {
  const anonymous = await createTestProfile(app, createdProfileIds, "Refresh Replay");
  const rotated = await app.inject({
    method: "POST",
    url: "/auth/refresh",
    payload: { refreshToken: anonymous.refreshToken }
  });
  assert.equal(rotated.statusCode, 200);
  assert.notEqual(rotated.json().refreshToken, anonymous.refreshToken);
  const replay = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken: anonymous.refreshToken } });
  assert.equal(replay.statusCode, 401);
});

test("anonymous records merge into an existing email account", async () => {
  const email = `merge-${Date.now()}@example.com`;
  const owner = await createTestProfile(app, createdProfileIds, "Merge Owner");
  const source = await createTestProfile(app, createdProfileIds, "Merge Source");

  const ownerLinkResponse = await app.inject({ method: "POST", url: "/auth/request-link", headers: auth(owner.token), payload: { email } });
  assert.equal(ownerLinkResponse.statusCode, 202);
  const ownerToken = new URL(getLastConsoleLoginLink()!).searchParams.get("token");
  assert.ok(ownerToken);
  const ownerVerified = await app.inject({ method: "POST", url: "/auth/verify", payload: { token: ownerToken } });
  assert.equal(ownerVerified.statusCode, 200);
  const [ownerRow] = await db.select().from(profiles).where(eq(profiles.id, owner.profile.id));
  assert.ok(ownerRow?.accountId);
  createdAccountIds.push(ownerRow.accountId);

  const record = await app.inject({
    method: "POST",
    url: "/cup-things",
    headers: auth(source.token),
    payload: { name: "Merged Record", category: "coffee", consumedAt: new Date().toISOString(), flavors: [] }
  });
  assert.equal(record.statusCode, 201);

  const sourceLinkResponse = await app.inject({ method: "POST", url: "/auth/request-link", headers: auth(source.token), payload: { email } });
  assert.equal(sourceLinkResponse.statusCode, 202);
  const sourceToken = new URL(getLastConsoleLoginLink()!).searchParams.get("token");
  assert.ok(sourceToken);
  const sourceVerified = await app.inject({ method: "POST", url: "/auth/verify", payload: { token: sourceToken } });
  assert.equal(sourceVerified.statusCode, 200);
  assert.equal(sourceVerified.json().profile.id, ownerVerified.json().profile.id);

  const sourceRows = await db.select().from(cupThings).where(eq(cupThings.profileId, source.profile.id));
  assert.equal(sourceRows.length, 0);
  const ownerRows = await db.select().from(cupThings).where(eq(cupThings.profileId, owner.profile.id));
  assert.equal(ownerRows.length, 1);
});

test("expired login challenges cannot be verified", async () => {
  const anonymous = await createTestProfile(app, createdProfileIds, "Expired Challenge");
  const email = `expired-${Date.now()}@example.com`;
  const requested = await app.inject({ method: "POST", url: "/auth/request-link", headers: auth(anonymous.token), payload: { email } });
  assert.equal(requested.statusCode, 202);
  const token = new URL(getLastConsoleLoginLink()!).searchParams.get("token");
  assert.ok(token);
  await db.update(loginChallenges).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(loginChallenges.email, email));
  const response = await app.inject({ method: "POST", url: "/auth/verify", payload: { token } });
  assert.equal(response.statusCode, 401);
});

test("health and readiness expose process and database state", async () => {
  const health = await app.inject({ method: "GET", url: "/health" });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { ok: true });
  assert.equal(health.headers["cache-control"], "no-store");

  const ready = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(ready.statusCode, 200);
  assert.deepEqual(ready.json(), { ok: true });
});

test("profile creation rejects oversized request bodies", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/profiles",
    payload: { displayName: "x".repeat(40_000) }
  });

  assert.equal(response.statusCode, 413);
});

test("CupThing CRUD, filtering, review stats, profile isolation, and malformed UUID handling", async () => {
  const first = await createTestProfile(app, createdProfileIds, "Test Profile One");
  const second = await createTestProfile(app, createdProfileIds, "Test Profile Two");

  const now = new Date();
  const consumedAt = now.toISOString();
  const from = new Date(now.getTime() - 60_000).toISOString();
  const to = new Date(now.getTime() + 60_000).toISOString();

  const createResponse = await app.inject({
    method: "POST",
    url: "/cup-things",
    headers: auth(first.token),
    payload: {
      name: "Integration Espresso",
      category: "coffee",
      consumedAt,
      location: "Test Bar",
      style: "Espresso",
      flavors: ["bright", "cocoa"],
      rating: 4.5,
      notes: "Created by test"
    }
  });
  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json().cupThing;

  const isolated = await app.inject({
    method: "GET",
    url: `/cup-things/${created.id}`,
    headers: auth(second.token)
  });
  assert.equal(isolated.statusCode, 404);

  const malformed = await app.inject({
    method: "GET",
    url: "/cup-things/not-a-uuid",
    headers: auth(first.token)
  });
  assert.equal(malformed.statusCode, 400);

  const list = await app.inject({
    method: "GET",
    url: `/cup-things?category=coffee&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    headers: auth(first.token)
  });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().cupThings.length, 1);

  const invalidRating = await app.inject({
    method: "POST",
    url: "/cup-things",
    headers: auth(first.token),
    payload: {
      name: "Bad Rating",
      category: "coffee",
      consumedAt,
      flavors: [],
      rating: 4.25
    }
  });
  assert.equal(invalidRating.statusCode, 400);

  const invalidNotes = await app.inject({
    method: "POST",
    url: "/cup-things",
    headers: auth(first.token),
    payload: {
      name: "Too Much Notes",
      category: "coffee",
      consumedAt,
      flavors: [],
      notes: "x".repeat(2_001)
    }
  });
  assert.equal(invalidNotes.statusCode, 400);

  const update = await app.inject({
    method: "PATCH",
    url: `/cup-things/${created.id}`,
    headers: auth(first.token),
    payload: { rating: 5, notes: "Updated by test" }
  });
  assert.equal(update.statusCode, 200);
  assert.equal(update.json().cupThing.rating, 5);

  const review = await app.inject({
    method: "GET",
    url: `/reviews?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    headers: auth(first.token)
  });
  assert.equal(review.statusCode, 200);
  assert.equal(review.json().stats.totalCount, 1);
  assert.equal(review.json().stats.countByCategory.coffee, 1);
  assert.equal(review.json().stats.averageRating, 5);

  const categoryReview = await app.inject({
    method: "GET",
    url: `/reviews?category=coffee&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    headers: auth(first.token)
  });
  assert.equal(categoryReview.statusCode, 200);
  assert.equal(categoryReview.json().records.length, 1);
  assert.equal(categoryReview.json().stats.averageRating, 5);

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/cup-things/${created.id}`,
    headers: auth(first.token)
  });
  assert.equal(deleteResponse.statusCode, 204);
});

test("profile creation is rate limited per app instance", async () => {
  const limitedApp = await buildApp();
  try {
    const responses = [];
    for (let index = 0; index < 6; index += 1) {
      responses.push(await limitedApp.inject({
        method: "POST",
        url: "/profiles",
        payload: { displayName: `Rate Limit ${index}` }
      }));
    }

    assert.deepEqual(responses.slice(0, 5).map((response) => response.statusCode), [201, 201, 201, 201, 201]);
    assert.equal(responses[5]?.statusCode, 429);
    assert.equal(responses[5]?.headers["retry-after"], "60");
    for (const response of responses.slice(0, 5)) {
      const id = response.json().profile.id as string;
      createdProfileIds.push(id);
    }
  } finally {
    await limitedApp.close();
  }
});
