/**
 * Alibaba Cloud Bailian (DashScope) Provider configuration boundary.
 *
 * Bailian has no official JS/TS SDK, so the adapter calls DashScope directly
 * via REST. Auth is `Authorization: Bearer {apiKey}` (live-confirmed). The
 * region-scoped `baseUrl` embeds the workspace id and region, e.g.
 * `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1`.
 */
export interface AliyunBailianConfig {
  /** DashScope API key sent as the `Authorization: Bearer` credential. */
  readonly apiKey: string;
  /** Region-scoped DashScope API base, e.g. `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1`. */
  readonly baseUrl: string;
}
