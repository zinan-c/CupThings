import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";

export async function createTestProfile(app: FastifyInstance, createdProfileIds: string[], displayName: string) {
  const response = await app.inject({
    method: "POST",
    url: "/profiles",
    headers: { "x-forwarded-for": `10.0.0.${createdProfileIds.length + 1}` },
    payload: { displayName }
  });
  assert.equal(response.statusCode, 201);
  const body = response.json();
  createdProfileIds.push(body.profile.id);
  return { profile: body.profile, token: body.token as string, refreshToken: body.refreshToken as string };
}

export function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

export function cookieHeader(value: string | string[] | undefined) {
  assert.ok(value);
  const values = Array.isArray(value) ? value : [value];
  return values.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}
