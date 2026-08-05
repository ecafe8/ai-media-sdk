/** DashScope temporary-file upload base URL (get-policy endpoint host). */
export const ALIYUN_UPLOAD_BASE_URL = "https://dashscope.aliyuncs.com";

/** Path of the get-policy endpoint (appended to the base URL). */
export const ALIYUN_UPLOAD_POLICY_PATH = "/api/v1/uploads";

/** DashScope temporary-URL lifetime in hours (per Aliyun docs). */
export const ALIYUN_TTL_HOURS = 48;

/** Default per-request timeout for Aliyun upload HTTP calls. */
export const ALIYUN_DEFAULT_TIMEOUT_MS = 30_000;

/** Aliyun policy endpoint rate limit per account+model (QPS). */
export const ALIYUN_POLICY_QPS_LIMIT = 100;
