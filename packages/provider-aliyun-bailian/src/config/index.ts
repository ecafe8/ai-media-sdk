/**
 * Alibaba Cloud Bailian (DashScope) Provider configuration boundary.
 *
 * Bailian has no official JS/TS SDK, so the future adapter calls DashScope
 * directly via REST. Phase 0 only defines the configuration shape; it never
 * reads credentials or performs a network call.
 */
export interface AliyunBailianConfig {
  /** DashScope API key. */
  readonly apiKey: string;
  /** Optional DashScope base URL override. */
  readonly baseUrl?: string;
}
