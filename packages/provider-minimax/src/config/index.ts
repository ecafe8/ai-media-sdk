/**
 * MiniMax (Hailuo) Provider configuration boundary.
 *
 * MiniMax has no official JS/TS SDK, so the adapter calls the MiniMax V2
 * video API directly via REST. Auth is `Authorization: Bearer {apiKey}`.
 * The `baseUrl` defaults to the global MiniMax API endpoint
 * `https://api.minimax.io`; callers targeting another deployment pass
 * `baseUrl` explicitly.
 */
const DEFAULT_BASE_URL = "https://api.minimax.io";

/**
 * MiniMax Provider configuration.
 */
export interface MiniMaxConfig {
  /** MiniMax API key sent as the `Authorization: Bearer` credential. */
  readonly apiKey: string;
  /** MiniMax API base; defaults to `https://api.minimax.io`. */
  readonly baseUrl?: string;
}

/**
 * Resolve the effective base URL, falling back to the MiniMax global default.
 * Trailing slashes are normalized so request paths concatenate cleanly.
 */
export function resolveBaseUrl(config: MiniMaxConfig): string {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
}
