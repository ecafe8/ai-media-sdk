import {
  type AliyunBailianProvider,
  createAliyunBailianProvider,
} from "@ai-media/provider-aliyun-bailian";
import {
  type AzureOpenAIProvider,
  createAzureOpenAIProvider,
} from "@ai-media/provider-azure-openai";
import {
  createMiniMaxProvider,
  type MiniMaxProvider,
} from "@ai-media/provider-minimax";
import {
  createVolcengineProvider,
  type VolcengineProvider,
} from "@ai-media/provider-volcengine";
import { createTransport } from "@ai-media/sdk";

import {
  ENDPOINT_ERROR_TEXT,
  type EndpointErrorCode,
  type ProviderCredentials,
  type SiteProvider,
  validateProviderEndpoint,
} from "./key-store";

/**
 * Provider instantiation from stored BYO credentials. Endpoint validation
 * runs both here (before instantiation) and is re-checked by the executor
 * before every request, so a stale or tampered endpoint can never receive a
 * key silently.
 */

export const SITE_PROVIDER_TIMEOUT_MS = 120_000;

export type AnySiteProvider =
  | AzureOpenAIProvider
  | AliyunBailianProvider
  | VolcengineProvider
  | MiniMaxProvider;

export type EndpointUnusableReason =
  | "MISSING_FIELD"
  | "INVALID_ENDPOINT"
  | "UNCONFIRMED_HOST";

/**
 * Structured endpoint failure. `message` is a stable English fallback; the
 * UI localizes from `reason` plus the structured fields.
 */
export class EndpointNotUsableError extends Error {
  readonly provider: SiteProvider;
  readonly reason: EndpointUnusableReason;
  readonly field?: string;
  readonly host?: string;
  readonly endpointErrorCode?: EndpointErrorCode;

  constructor(
    provider: SiteProvider,
    reason: EndpointUnusableReason,
    message: string,
    extras?: {
      readonly field?: string;
      readonly host?: string;
      readonly endpointErrorCode?: EndpointErrorCode;
    }
  ) {
    super(message);
    this.name = "EndpointNotUsableError";
    this.provider = provider;
    this.reason = reason;
    this.field = extras?.field;
    this.host = extras?.host;
    this.endpointErrorCode = extras?.endpointErrorCode;
  }
}

function assertEndpointUsable(
  provider: SiteProvider,
  label: string,
  value: string | undefined,
  confirmedHosts: readonly string[],
  required: boolean
): string | undefined {
  if (!value?.trim()) {
    if (!required) return undefined;
    throw new EndpointNotUsableError(
      provider,
      "MISSING_FIELD",
      `${label} is required`,
      { field: label }
    );
  }
  const validation = validateProviderEndpoint(provider, value);
  if (!validation.ok) {
    const detail = ENDPOINT_ERROR_TEXT[validation.errorCode ?? "EMPTY"];
    throw new EndpointNotUsableError(
      provider,
      "INVALID_ENDPOINT",
      `${label} is not usable: ${detail}`,
      { field: label, endpointErrorCode: validation.errorCode }
    );
  }
  if (validation.isCustomHost && !confirmedHosts.includes(validation.host!)) {
    throw new EndpointNotUsableError(
      provider,
      "UNCONFIRMED_HOST",
      `The custom endpoint ${validation.host} has not been confirmed; confirm it in API settings before sending requests`,
      { host: validation.host }
    );
  }
  return value.trim();
}

/**
 * Build a provider instance from credentials. Throws
 * `EndpointNotUsableError` when an endpoint is structurally invalid or is a
 * custom host without explicit confirmation.
 */
export function buildSiteProvider(
  provider: SiteProvider,
  credentials: ProviderCredentials,
  confirmedHosts: readonly string[]
): AnySiteProvider {
  const transport = createTransport({
    defaultTimeoutMs: SITE_PROVIDER_TIMEOUT_MS,
  });

  if (provider === "azure-openai") {
    const endpoint = assertEndpointUsable(
      provider,
      "Endpoint",
      credentials.endpoint,
      confirmedHosts,
      true
    );
    return createAzureOpenAIProvider(
      {
        apiKey: credentials.apiKey.trim(),
        endpoint: endpoint!,
        apiVersion: credentials.apiVersion!.trim(),
      },
      { transport }
    );
  }

  if (provider === "volcengine") {
    const baseUrl = assertEndpointUsable(
      provider,
      "Base URL",
      credentials.baseUrl,
      confirmedHosts,
      false
    );
    return createVolcengineProvider(
      {
        apiKey: credentials.apiKey.trim(),
        ...(baseUrl ? { baseUrl } : {}),
      },
      { transport }
    );
  }

  if (provider === "minimax") {
    const baseUrl = assertEndpointUsable(
      provider,
      "Base URL",
      credentials.baseUrl,
      confirmedHosts,
      false
    );
    return createMiniMaxProvider(
      {
        apiKey: credentials.apiKey.trim(),
        ...(baseUrl ? { baseUrl } : {}),
      },
      { transport }
    );
  }

  const baseUrl = assertEndpointUsable(
    provider,
    "Base URL",
    credentials.baseUrl,
    confirmedHosts,
    true
  );
  return createAliyunBailianProvider(
    { apiKey: credentials.apiKey.trim(), baseUrl: baseUrl! },
    { transport }
  );
}
