"use client";

export type ApiState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string;
};

export type ApiResult<T> = {
  data: T | null;
  error: string;
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

export function apiPath(path: string) {
  const baseUrl = trimSlashes(API_BASE_URL);
  const nextPath = trimSlashes(path);

  return baseUrl ? `${baseUrl}/${nextPath}` : `/${nextPath}`;
}

export async function safeFetch<T>(
  path: string,
  { body, headers, ...options }: RequestOptions = {},
): Promise<ApiResult<T>> {
  if (!API_BASE_URL) {
    return {
      data: null,
      error: "Backend URL is not configured. Using mock data.",
    };
  }

  try {
    const response = await fetch(apiPath(path), {
      ...options,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      return {
        data: null,
        error: `Backend returned ${response.status}. Using mock data.`,
      };
    }

    return {
      data: (await response.json()) as T,
      error: "",
    };
  } catch {
    return {
      data: null,
      error: "Could not reach backend. Using mock data.",
    };
  }
}

export const api = {
  health: () => safeFetch<Record<string, unknown>>("/health"),
  sessions: (status?: string) =>
    safeFetch<Record<string, unknown>>(`/sessions${status ? `?status=${status}` : ""}`),
  sessionState: (sessionId: string) =>
    safeFetch<Record<string, unknown>>(`/sessions/${encodeURIComponent(sessionId)}/state`),
  insights: (sessionId: string) =>
    safeFetch<Record<string, unknown>>(`/sessions/${encodeURIComponent(sessionId)}/insights`),
  suggestions: (sessionId: string) =>
    safeFetch<Record<string, unknown>>(`/sessions/${encodeURIComponent(sessionId)}/suggestions`),
  billingSummary: (sessionId: string) =>
    safeFetch<Record<string, unknown>>(`/sessions/${encodeURIComponent(sessionId)}/billing-summary`),
  endSession: (sessionId: string) =>
    safeFetch<Record<string, unknown>>(`/sessions/${encodeURIComponent(sessionId)}/end`, {
      method: "POST",
    }),
  applySuggestion: (sessionId: string, suggestionId: string) =>
    safeFetch<Record<string, unknown>>(
      `/sessions/${encodeURIComponent(sessionId)}/suggestions/${encodeURIComponent(suggestionId)}/apply`,
      { method: "POST" },
    ),
  approveAlert: (sessionId: string, alertId: string) =>
    safeFetch<Record<string, unknown>>(
      `/sessions/${encodeURIComponent(sessionId)}/alerts/${encodeURIComponent(alertId)}/approve`,
      { method: "POST" },
    ),
};

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function findArray(value: unknown, keys: string[] = []): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const record = asRecord(value);

  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key];
    }
  }

  for (const item of Object.values(record)) {
    if (Array.isArray(item)) {
      return item;
    }
  }

  return [];
}

export function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
