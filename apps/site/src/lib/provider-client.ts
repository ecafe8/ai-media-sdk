import {
  type AliyunBailianProvider,
  createAliyunBailianProvider,
} from "@ai-media/provider-aliyun-bailian";
import {
  type AzureOpenAIProvider,
  createAzureOpenAIProvider,
} from "@ai-media/provider-azure-openai";
import {
  createSeedreamProvider,
  type SeedreamProvider,
} from "@ai-media/provider-seedream";
import { createTransport } from "@ai-media/sdk";

import {
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
  | SeedreamProvider;

export class EndpointNotUsableError extends Error {
  readonly provider: SiteProvider;
  readonly host?: string;

  constructor(provider: SiteProvider, message: string, host?: string) {
    super(message);
    this.name = "EndpointNotUsableError";
    this.provider = provider;
    this.host = host;
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
    throw new EndpointNotUsableError(provider, `${label} 不能为空`);
  }
  const validation = validateProviderEndpoint(provider, value);
  if (!validation.ok) {
    throw new EndpointNotUsableError(
      provider,
      `${label} 不可用：${validation.error}`
    );
  }
  if (validation.isCustomHost && !confirmedHosts.includes(validation.host!)) {
    throw new EndpointNotUsableError(
      provider,
      `自定义端点 ${validation.host} 尚未确认，请在 API 设置中确认后再发送请求`,
      validation.host
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

  if (provider === "doubao-seedream") {
    const baseUrl = assertEndpointUsable(
      provider,
      "Base URL",
      credentials.baseUrl,
      confirmedHosts,
      false
    );
    return createSeedreamProvider(
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
