import { useSyncExternalStore } from "react";

/**
 * Browser-side BYO credential store.
 *
 * Credentials live in `localStorage` only and are sent exclusively to the
 * owning provider endpoint. Custom (non-allowlisted) endpoint hosts require
 * an explicit one-time confirmation that is persisted separately, so a typo
 * or a malicious endpoint never silently receives an API key.
 */

export type SiteProvider =
  | "azure-openai"
  | "aliyun-bailian"
  | "volcengine"
  | "minimax";

export const SITE_PROVIDERS: readonly SiteProvider[] = [
  "azure-openai",
  "aliyun-bailian",
  "volcengine",
  "minimax",
];

export const PROVIDER_LABELS: Readonly<Record<SiteProvider, string>> = {
  "azure-openai": "Azure OpenAI",
  "aliyun-bailian": "Alibaba Bailian",
  volcengine: "Volcengine Ark",
  minimax: "MiniMax",
};

export interface ProviderCredentials {
  readonly apiKey: string;
  /** Azure OpenAI resource endpoint. */
  readonly endpoint?: string;
  /** Azure OpenAI API version. */
  readonly apiVersion?: string;
  /** Bailian DashScope / Volcengine Ark / MiniMax base URL. */
  readonly baseUrl?: string;
}

export type CredentialsMap = Readonly<
  Partial<Record<SiteProvider, ProviderCredentials>>
>;

export interface KeyStoreSnapshot {
  readonly credentials: CredentialsMap;
  readonly confirmedHosts: readonly string[];
}

const CREDENTIALS_STORAGE_KEY = "ai-media-site.credentials.v1";
const CONFIRMED_HOSTS_STORAGE_KEY = "ai-media-site.confirmed-hosts.v1";

const CREDENTIAL_FIELDS = [
  "apiKey",
  "endpoint",
  "apiVersion",
  "baseUrl",
] as const;

const EMPTY_SNAPSHOT: KeyStoreSnapshot = {
  credentials: {},
  confirmedHosts: [],
};

const localListeners = new Set<() => void>();
let cachedCredentialsRaw = "";
let cachedHostsRaw = "";
let cachedSnapshot: KeyStoreSnapshot = EMPTY_SNAPSHOT;

function sanitizeCredentials(value: unknown): CredentialsMap {
  if (typeof value !== "object" || value === null) return {};
  const candidate = value as Record<string, unknown>;
  const result: Partial<Record<SiteProvider, ProviderCredentials>> = {};
  for (const provider of SITE_PROVIDERS) {
    const entry = candidate[provider];
    if (typeof entry !== "object" || entry === null) continue;
    const fields = entry as Record<string, unknown>;
    const credentials: Record<string, string> = {};
    for (const field of CREDENTIAL_FIELDS) {
      const item = fields[field];
      if (typeof item === "string" && item.trim().length > 0) {
        credentials[field] = item;
      }
    }
    if (credentials.apiKey) {
      result[provider] = credentials as unknown as ProviderCredentials;
    }
  }
  return result;
}

function sanitizeConfirmedHosts(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0
  );
}

function readSnapshot(): KeyStoreSnapshot {
  if (typeof window === "undefined") return EMPTY_SNAPSHOT;
  let credentialsRaw = "";
  let hostsRaw = "";
  try {
    credentialsRaw = window.localStorage.getItem(CREDENTIALS_STORAGE_KEY) ?? "";
    hostsRaw = window.localStorage.getItem(CONFIRMED_HOSTS_STORAGE_KEY) ?? "";
  } catch {
    return EMPTY_SNAPSHOT;
  }
  if (credentialsRaw !== cachedCredentialsRaw || hostsRaw !== cachedHostsRaw) {
    cachedCredentialsRaw = credentialsRaw;
    cachedHostsRaw = hostsRaw;
    let credentials: CredentialsMap = {};
    let confirmedHosts: readonly string[] = [];
    try {
      credentials = credentialsRaw
        ? sanitizeCredentials(JSON.parse(credentialsRaw))
        : {};
    } catch {
      credentials = {};
    }
    try {
      confirmedHosts = hostsRaw
        ? sanitizeConfirmedHosts(JSON.parse(hostsRaw))
        : [];
    } catch {
      confirmedHosts = [];
    }
    cachedSnapshot = { credentials, confirmedHosts };
  }
  return cachedSnapshot;
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

function writeStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode/quota); the in-memory
    // snapshot still serves the current session.
  }
}

/**
 * React hook exposing credentials plus confirmed custom hosts. Server
 * snapshots are empty, keeping hydration deterministic.
 */
export function useKeyStore(): KeyStoreSnapshot {
  return useSyncExternalStore(subscribe, readSnapshot, () => EMPTY_SNAPSHOT);
}

export function getCredentials(
  provider: SiteProvider
): ProviderCredentials | undefined {
  return readSnapshot().credentials[provider];
}

export function getConfirmedHosts(): readonly string[] {
  return readSnapshot().confirmedHosts;
}

function invalidateCache(): void {
  cachedCredentialsRaw = "";
  cachedHostsRaw = "";
}

export function setCredentials(
  provider: SiteProvider,
  credentials: ProviderCredentials
): void {
  const next = { ...readSnapshot().credentials, [provider]: credentials };
  writeStorage(CREDENTIALS_STORAGE_KEY, next);
  invalidateCache();
  notifyListeners();
}

export function clearCredentials(provider: SiteProvider): void {
  const next = { ...readSnapshot().credentials };
  delete next[provider];
  writeStorage(CREDENTIALS_STORAGE_KEY, next);
  invalidateCache();
  notifyListeners();
}

export function clearAllCredentials(): void {
  writeStorage(CREDENTIALS_STORAGE_KEY, {});
  invalidateCache();
  notifyListeners();
}

export function confirmCustomHost(host: string): void {
  const hosts = readSnapshot().confirmedHosts;
  if (hosts.includes(host)) return;
  writeStorage(CONFIRMED_HOSTS_STORAGE_KEY, [...hosts, host]);
  invalidateCache();
  notifyListeners();
}

export function revokeCustomHost(host: string): void {
  const hosts = readSnapshot().confirmedHosts.filter((item) => item !== host);
  writeStorage(CONFIRMED_HOSTS_STORAGE_KEY, hosts);
  invalidateCache();
  notifyListeners();
}

/**
 * Required-field completeness per provider, mirroring the server-side
 * playground resolver rules.
 */
export function isCredentialsComplete(
  provider: SiteProvider,
  credentials: ProviderCredentials | undefined
): boolean {
  if (!credentials?.apiKey.trim()) return false;
  switch (provider) {
    case "azure-openai":
      return Boolean(
        credentials.endpoint?.trim() && credentials.apiVersion?.trim()
      );
    case "aliyun-bailian":
      return Boolean(credentials.baseUrl?.trim());
    case "volcengine":
      return true;
    case "minimax":
      return true;
  }
}

export function getConfiguredProviders(
  map: CredentialsMap
): ReadonlySet<SiteProvider> {
  const configured = new Set<SiteProvider>();
  for (const provider of SITE_PROVIDERS) {
    if (isCredentialsComplete(provider, map[provider])) {
      configured.add(provider);
    }
  }
  return configured;
}

/**
 * Default endpoint host allowlists. Hosts outside the list are treated as
 * custom and require explicit confirmation before any key is sent to them.
 */
const DEFAULT_HOST_ALLOWLIST: Readonly<
  Record<SiteProvider, readonly string[]>
> = {
  "azure-openai": [".openai.azure.com", ".cognitiveservices.azure.com"],
  "aliyun-bailian": [".aliyuncs.com"],
  volcengine: [".volces.com"],
  minimax: [".minimax.io"],
};

/**
 * Stable endpoint-validation error codes. The UI renders localized text
 * from `errors.endpoint.<code>`; `ENDPOINT_ERROR_TEXT` provides English
 * fallbacks for non-UI consumers.
 */
export type EndpointErrorCode =
  | "EMPTY"
  | "NOT_URL"
  | "NOT_HTTPS"
  | "HAS_CREDENTIALS"
  | "NON_STANDARD_PORT";

export const ENDPOINT_ERROR_TEXT: Readonly<Record<EndpointErrorCode, string>> =
  {
    EMPTY: "The endpoint is required",
    NOT_URL: "The endpoint is not a valid URL",
    NOT_HTTPS: "The endpoint must use HTTPS",
    HAS_CREDENTIALS: "The endpoint must not contain a username or password",
    NON_STANDARD_PORT: "The endpoint must not use a non-standard port",
  };

export interface EndpointValidation {
  readonly ok: boolean;
  /** Host is structurally valid but outside the default allowlist. */
  readonly isCustomHost: boolean;
  readonly host?: string;
  readonly errorCode?: EndpointErrorCode;
}

/**
 * Structural validation of a provider endpoint/base URL. Rejects non-HTTPS
 * schemes, embedded credentials, and non-standard ports. Custom hosts pass
 * structurally but are flagged for explicit confirmation.
 */
export function validateProviderEndpoint(
  provider: SiteProvider,
  value: string | undefined
): EndpointValidation {
  if (!value?.trim()) {
    return { ok: false, isCustomHost: false, errorCode: "EMPTY" };
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { ok: false, isCustomHost: false, errorCode: "NOT_URL" };
  }
  if (url.protocol !== "https:") {
    return {
      ok: false,
      isCustomHost: false,
      errorCode: "NOT_HTTPS",
    };
  }
  if (url.username || url.password) {
    return {
      ok: false,
      isCustomHost: false,
      errorCode: "HAS_CREDENTIALS",
    };
  }
  if (url.port !== "" && url.port !== "443") {
    return {
      ok: false,
      isCustomHost: false,
      errorCode: "NON_STANDARD_PORT",
    };
  }
  const host = url.hostname.toLowerCase();
  const allowlist = DEFAULT_HOST_ALLOWLIST[provider];
  const isDefault = allowlist.some(
    (suffix) => host === suffix.slice(1) || host.endsWith(suffix)
  );
  return { ok: true, isCustomHost: !isDefault, host };
}

/**
 * Missing required fields for a provider, used for actionable guidance.
 */
export function missingCredentialFields(
  provider: SiteProvider,
  credentials: ProviderCredentials | undefined
): readonly string[] {
  const missing: string[] = [];
  if (!credentials?.apiKey.trim()) missing.push("API Key");
  switch (provider) {
    case "azure-openai":
      if (!credentials?.endpoint?.trim()) missing.push("Endpoint");
      if (!credentials?.apiVersion?.trim()) missing.push("API Version");
      break;
    case "aliyun-bailian":
      if (!credentials?.baseUrl?.trim()) missing.push("Base URL");
      break;
    case "volcengine":
      break;
    case "minimax":
      break;
  }
  return missing;
}
