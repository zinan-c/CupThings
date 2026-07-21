import type {
  CreateCupThingInput,
  CupThing,
  CupThingCategory,
  Profile,
  ReviewResponse,
  UpdateCupThingInput
} from "@cupthings/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "cupthings.token";
const STORAGE_MESSAGE = "Browser storage is unavailable. Enable site storage to keep your CupThings profile.";

export function getToken() {
  return storage().getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  storage().setItem(TOKEN_KEY, token);
}

export function clearToken() {
  try {
    storage().removeItem(TOKEN_KEY);
  } catch (error) {
    if (!(error instanceof StorageUnavailableError)) throw error;
  }
}

export async function requestLogin(email: string, displayName?: string) {
  return request<{ message: string }>("/auth/request-link", {
    method: "POST",
    body: { email, displayName }
  });
}

export async function verifyLogin(token: string) {
  const result = await request<{ profile: Profile; token: string; refreshToken: string }>("/auth/verify", {
    method: "POST",
    body: { token },
    auth: false
  });
  clearToken();
  return result;
}

export async function logoutSession() {
  return request<void>("/auth/logout", { method: "POST" });
}

export async function deleteAccount() {
  return request<void>("/account", { method: "DELETE" });
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
};

export class AuthRequiredError extends Error {
  constructor() {
    super("AUTH_REQUIRED");
    this.name = "AuthRequiredError";
  }
}

export class StorageUnavailableError extends Error {
  constructor() {
    super(STORAGE_MESSAGE);
    this.name = "StorageUnavailableError";
  }
}

export class NetworkError extends Error {
  constructor() {
    super("CupThings is temporarily unavailable. Check your connection and try again.");
    this.name = "NetworkError";
  }
}

function storage(): Storage {
  try {
    if (!window.localStorage) throw new Error("localStorage unavailable");
    return window.localStorage;
  } catch {
    throw new StorageUnavailableError();
  }
}

export function isStorageAvailable() {
  try {
    const store = storage();
    const probeKey = `${TOKEN_KEY}.probe`;
    store.setItem(probeKey, "1");
    store.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const headers = new Headers();
  let token: string | null = null;
  try {
    token = getToken();
  } catch (error) {
    if (!(error instanceof StorageUnavailableError)) throw error;
  }

  if (options.body != null) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const timeoutController = new AbortController();
  const timeout = window.setTimeout(() => timeoutController.abort(), 10_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body == null ? undefined : JSON.stringify(options.body),
      signal,
      cache: "no-store",
      credentials: "include"
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new NetworkError();
  } finally {
    window.clearTimeout(timeout);
  }

  if (response.status === 401) {
    if (!retried && !token && path !== "/auth/refresh" && path !== "/auth/verify") {
      const refreshed = await refreshSession();
      if (refreshed) return request<T>(path, options, true);
    }
    clearToken();
    window.dispatchEvent(new Event("cupthings:auth-required"));
    throw new AuthRequiredError();
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(payload.error ?? "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function refreshSession() {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      credentials: "include"
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function createProfile(displayName: string) {
  return request<{ profile: Profile; token: string }>("/profiles", {
    method: "POST",
    body: { displayName },
    auth: false
  });
}

export async function getMe() {
  return request<{ profile: Profile }>("/me");
}

export async function listCupThings(filters: {
  category?: CupThingCategory;
  from?: string;
  to?: string;
}, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return request<{ cupThings: CupThing[] }>(`/cup-things${query ? `?${query}` : ""}`, {
    signal: options.signal
  });
}

export async function getCupThing(id: string) {
  return request<{ cupThing: CupThing }>(`/cup-things/${id}`);
}

export async function createCupThing(input: CreateCupThingInput) {
  return request<{ cupThing: CupThing }>("/cup-things", {
    method: "POST",
    body: input
  });
}

export async function updateCupThing(id: string, input: UpdateCupThingInput) {
  return request<{ cupThing: CupThing }>(`/cup-things/${id}`, {
    method: "PATCH",
    body: input
  });
}

export async function deleteCupThing(id: string) {
  return request<void>(`/cup-things/${id}`, {
    method: "DELETE"
  });
}

export async function getReview(from: string, to: string, category?: CupThingCategory, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ from, to });
  if (category) params.set("category", category);
  return request<ReviewResponse>(`/reviews?${params.toString()}`, { signal: options.signal });
}
