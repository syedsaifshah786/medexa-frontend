"use client";

export type ApiState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string;
};

export type ApiResult<T> = {
  data: T | null;
  error: string;
  devWarning: string;
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const isDevelopment = process.env.NODE_ENV === "development";

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

export function apiPath(path: string) {
  const baseUrl = trimSlashes(API_BASE_URL);
  const nextPath = trimSlashes(path);

  return baseUrl ? `${baseUrl}/${nextPath}` : `/${nextPath}`;
}

function warnInDevelopment(path: string, message: string) {
  if (isDevelopment) {
    console.warn(`[Medexa API] ${path}: ${message}`);
  }
}

export async function safeFetch<T>(
  path: string,
  { body, headers, ...options }: RequestOptions = {},
): Promise<ApiResult<T>> {
  if (!API_BASE_URL) {
    warnInDevelopment(path, "Backend URL is not configured. Using mock data.");

    return {
      data: null,
      error: "",
      devWarning: isDevelopment ? "Backend URL is not configured. Using mock data." : "",
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
      warnInDevelopment(path, `Request failed with ${response.status}. Using mock data.`);

      return {
        data: null,
        error: "",
        devWarning: isDevelopment ? "Backend unavailable. Using mock data." : "",
      };
    }

    return {
      data: (await response.json()) as T,
      error: "",
      devWarning: "",
    };
  } catch (error) {
    warnInDevelopment(
      path,
      error instanceof Error ? `${error.message}. Using mock data.` : "Request failed. Using mock data.",
    );

    return {
      data: null,
      error: "",
      devWarning: isDevelopment ? "Could not reach backend. Using mock data." : "",
    };
  }
}

export const api = {
  startSession: (body: {
    patient_id?: string | null;
    patient_name?: string | null;
    mrn?: string | null;
    therapist_id?: string | null;
    session_type?: string | null;
  }) =>
    safeFetch<Record<string, unknown>>("/sessions/start", {
      method: "POST",
      body,
    }),
  sessions: (status?: string) =>
    safeFetch<Record<string, unknown>>(`/sessions${status ? `?status=${status}` : ""}`),
  transcriptChunk: (
    sessionId: string,
    body: {
      text: string;
      start_ts?: number;
      end_ts?: number;
      sequence?: number;
    },
  ) =>
    safeFetch<Record<string, unknown>>(
      `/sessions/${encodeURIComponent(sessionId)}/transcript-chunk`,
      {
        method: "POST",
        body,
      },
    ),
  sessionState: (sessionId: string) =>
    safeFetch<Record<string, unknown>>(`/sessions/${encodeURIComponent(sessionId)}/state`),
  insights: (sessionId: string) =>
    safeFetch<Record<string, unknown>>(`/sessions/${encodeURIComponent(sessionId)}/insights`),
  suggestions: (sessionId: string) =>
    safeFetch<Record<string, unknown>>(`/sessions/${encodeURIComponent(sessionId)}/suggestions`),
  alerts: (sessionId: string) =>
    safeFetch<Record<string, unknown>>(`/sessions/${encodeURIComponent(sessionId)}/alerts`),
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
