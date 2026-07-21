import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { buildApp } from "./app.js";
import { db, pool } from "./db/client.js";
import { profiles } from "./db/schema.js";

const app = await buildApp();
const createdProfileIds: string[] = [];

after(async () => {
  for (const id of createdProfileIds) {
    await db.delete(profiles).where(eq(profiles.id, id));
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
  assert.notEqual(row.tokenHash, body.token);
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
  const first = await createProfile("Test Profile One");
  const second = await createProfile("Test Profile Two");

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

async function createProfile(displayName: string) {
  const response = await app.inject({
    method: "POST",
    url: "/profiles",
    payload: { displayName }
  });
  assert.equal(response.statusCode, 201);
  const body = response.json();
  createdProfileIds.push(body.profile.id);
  return { profile: body.profile, token: body.token as string };
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}
