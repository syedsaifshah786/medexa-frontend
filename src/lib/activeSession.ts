"use client";

const ACTIVE_SESSION_KEY = "medexa-active-session-id";
export const DEFAULT_SESSION_ID = "samuel-thompson";

export function getActiveSessionId() {
  if (typeof window === "undefined") {
    return DEFAULT_SESSION_ID;
  }

  return window.localStorage.getItem(ACTIVE_SESSION_KEY) || DEFAULT_SESSION_ID;
}

export function setActiveSessionId(sessionId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
}
