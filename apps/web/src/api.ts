import type {
  CreateCupThingInput,
  CupThing,
  CupThingCategory,
  Profile,
  ReviewResponse,
  UpdateCupThingInput
} from "@cupthings/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "cupthings.token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
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

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  const token = getToken();

  if (options.body != null) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body == null ? undefined : JSON.stringify(options.body),
    signal: options.signal
  });

  if (response.status === 401) {
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

export async function getReview(from: string, to: string, category?: CupThingCategory) {
  const params = new URLSearchParams({ from, to });
  if (category) params.set("category", category);
  return request<ReviewResponse>(`/reviews?${params.toString()}`);
}
