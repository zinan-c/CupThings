import assert from "node:assert/strict";
import { test } from "node:test";

const storageData = new Map<string, string>();
const fakeStorage = {
  getItem: (key: string) => storageData.get(key) ?? null,
  setItem: (key: string, value: string) => storageData.set(key, value),
  removeItem: (key: string) => storageData.delete(key)
};

const events: Event[] = [];
(globalThis as { window?: unknown }).window = {
  localStorage: fakeStorage,
  setTimeout,
  clearTimeout,
  dispatchEvent: (event: Event) => { events.push(event); return true; }
};

const { request, setToken, getToken, StorageUnavailableError, NetworkError } = await import("./api/http-client.js");

test("API client sends Bearer and credentials together", async () => {
  storageData.clear();
  setToken("access-token");
  const originalFetch = globalThis.fetch;
  let captured: RequestInit | undefined;
  globalThis.fetch = async (_input, init) => {
    captured = init;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    await request<{ ok: boolean }>("/me");
    assert.equal(new Headers(captured?.headers).get("Authorization"), "Bearer access-token");
    assert.equal(captured?.credentials, "include");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("401 refreshes a Cookie session and retries once", async () => {
  storageData.clear();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls += 1;
    if (String(input).endsWith("/auth/refresh")) return new Response(null, { status: 204 });
    if (calls === 1) return new Response(null, { status: 401 });
    return new Response(JSON.stringify({ profile: { id: "p" } }), { status: 200 });
  };
  try {
    const result = await request<{ profile: { id: string } }>("/me");
    assert.equal(result.profile.id, "p");
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("network errors preserve anonymous token", async () => {
  storageData.clear();
  setToken("keep-me");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    await assert.rejects(request("/me"), NetworkError);
    assert.equal(getToken(), "keep-me");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Cookie sessions work when localStorage is unavailable", async () => {
  const originalStorage = (globalThis.window as { localStorage: unknown }).localStorage;
  Object.defineProperty(globalThis.window, "localStorage", { configurable: true, get: () => { throw new StorageUnavailableError(); } });
  const originalFetch = globalThis.fetch;
  let captured: RequestInit | undefined;
  globalThis.fetch = async (_input, init) => {
    captured = init;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    await request<{ ok: boolean }>("/me");
    assert.equal(new Headers(captured?.headers).get("Authorization"), null);
    assert.equal(captured?.credentials, "include");
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis.window, "localStorage", { configurable: true, value: originalStorage, writable: true });
  }
});

test("confirmed 401 dispatches auth-required", async () => {
  storageData.clear();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 401 });
  try {
    await assert.rejects(request("/me"));
    assert.ok(events.some((event) => event.type === "cupthings:auth-required"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
