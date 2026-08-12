"use client";

import { useSyncExternalStore } from "react";

import type {
  PlaygroundCredentials,
  PlaygroundProvider,
} from "@/lib/playground/types";

/**
 * Per-Provider BYO credentials persisted to the visitor's own browser
 * (`localStorage`). Values are only ever sent back to the Playground API
 * route for proxying; they never reach the Provider directly from the
 * browser.
 *
 * The map is exposed as an external store consumed via
 * `useSyncExternalStore`, so workbenches re-render on credential changes
 * (including cross-tab `storage` events) without effect-driven setState.
 */
export type StoredCredentialsMap = Readonly<
  Partial<Record<PlaygroundProvider, PlaygroundCredentials>>
>;

const STORAGE_KEY = "ai-media-playground.credentials.v1";

const PROVIDER_IDS: readonly PlaygroundProvider[] = [
  "azure-openai",
  "aliyun-bailian",
  "doubao-seedream",
  "minimax",
];

const CREDENTIAL_FIELDS = [
  "apiKey",
  "endpoint",
  "apiVersion",
  "baseUrl",
] as const;

const EMPTY_MAP: StoredCredentialsMap = {};

const localListeners = new Set<() => void>();
let cachedRaw = "";
let cachedMap: StoredCredentialsMap = EMPTY_MAP;

function sanitizeStoredCredentials(value: unknown): StoredCredentialsMap {
  if (typeof value !== "object" || value === null) return {};
  const candidate = value as Record<string, unknown>;
  const result: Partial<Record<PlaygroundProvider, PlaygroundCredentials>> = {};
  for (const provider of PROVIDER_IDS) {
    const entry = candidate[provider];
    if (typeof entry !== "object" || entry === null) continue;
    const fields = entry as Record<string, unknown>;
    const credentials: Record<string, string> = {};
    for (const field of CREDENTIAL_FIELDS) {
      const item = fields[field];
      if (typeof item === "string" && item.length > 0) {
        credentials[field] = item;
      }
    }
    if (credentials.apiKey) {
      result[provider] = credentials as unknown as PlaygroundCredentials;
    }
  }
  return result;
}

function readSnapshot(): StoredCredentialsMap {
  if (typeof window === "undefined") return EMPTY_MAP;
  let raw = "";
  try {
    raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return EMPTY_MAP;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedMap = raw ? sanitizeStoredCredentials(JSON.parse(raw)) : EMPTY_MAP;
    } catch {
      cachedMap = EMPTY_MAP;
    }
  }
  return cachedMap;
}

function subscribe(listener: () => void): () => void {
  localListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    localListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function notifyListeners(): void {
  for (const listener of localListeners) listener();
}

function writeStoredCredentials(map: StoredCredentialsMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage may be unavailable (private mode/quota); the store still
    // serves the last in-memory snapshot for the current session.
  }
  cachedRaw = JSON.stringify(map);
  cachedMap = map;
  notifyListeners();
}

/**
 * React hook exposing the persisted credentials map. Server renders always
 * observe an empty map so hydration stays deterministic.
 */
export function useStoredCredentials(): StoredCredentialsMap {
  return useSyncExternalStore(subscribe, readSnapshot, () => EMPTY_MAP);
}

export function setStoredCredentials(
  provider: PlaygroundProvider,
  credentials: PlaygroundCredentials
): void {
  writeStoredCredentials({ ...readSnapshot(), [provider]: credentials });
}

export function clearStoredCredentials(provider: PlaygroundProvider): void {
  const next = { ...readSnapshot() };
  delete next[provider];
  writeStoredCredentials(next);
}

/**
 * Trim all credential fields and drop empties. Returns `undefined` when no
 * usable `apiKey` remains so callers can treat the result as absent.
 */
export function normalizeCredentials(
  credentials: PlaygroundCredentials | undefined
): PlaygroundCredentials | undefined {
  if (!credentials) return undefined;
  const apiKey = credentials.apiKey.trim();
  if (!apiKey) return undefined;
  const endpoint = credentials.endpoint?.trim();
  const apiVersion = credentials.apiVersion?.trim();
  const baseUrl = credentials.baseUrl?.trim();
  return {
    apiKey,
    ...(endpoint ? { endpoint } : {}),
    ...(apiVersion ? { apiVersion } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  };
}

/**
 * Whether the supplied credentials satisfy the Provider's required fields.
 * Mirrors the server-side resolver's completeness rules.
 */
export function isCredentialsComplete(
  provider: PlaygroundProvider,
  credentials: PlaygroundCredentials | undefined
): boolean {
  const normalized = normalizeCredentials(credentials);
  if (!normalized) return false;
  switch (provider) {
    case "azure-openai":
      return Boolean(normalized.endpoint && normalized.apiVersion);
    case "aliyun-bailian":
      return Boolean(normalized.baseUrl);
    case "doubao-seedream":
      return true;
    case "minimax":
      return true;
  }
}
