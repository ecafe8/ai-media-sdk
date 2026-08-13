/**
 * Volcengine Ark Provider configuration boundary.
 *
 * The adapter calls the Ark OpenAI-compatible image API directly via REST.
 * Auth is `Authorization: Bearer {apiKey}` (live-confirmed). The regional
 * `baseUrl` defaults to the `ark+cn-beijing` endpoint
 * `https://ark.cn-beijing.volces.com/api/v3`; callers targeting another region
 * pass `baseUrl` explicitly.
 */
const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

/**
 * Volcengine Ark Provider configuration.
 */
export interface VolcengineConfig {
  /** Ark API key sent as the `Authorization: Bearer` credential. */
  readonly apiKey: string;
  /** Regional Ark API base; defaults to `https://ark.cn-beijing.volces.com/api/v3`. */
  readonly baseUrl?: string;
}

/**
 * Resolve the effective base URL, falling back to the Ark cn-beijing default.
 */
export function resolveBaseUrl(config: VolcengineConfig): string {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
}
