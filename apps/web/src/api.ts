import type {
  CreateCupThingInput,
  CupThing,
  CupThingCategory,
  Profile,
  ReviewResponse,
  UpdateCupThingInput
} from "@cupthings/shared";
export { AuthRequiredError, NetworkError, StorageUnavailableError } from "./api/http-client";
export { getToken, clearToken, setToken, isStorageAvailable } from "./api/http-client";
import { clearToken, request } from "./api/http-client";

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
