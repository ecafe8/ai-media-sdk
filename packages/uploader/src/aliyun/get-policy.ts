import { UPLOADER_ERROR_CODES, UploaderError } from "../core/index.ts";
import {
  ALIYUN_DEFAULT_TIMEOUT_MS,
  ALIYUN_UPLOAD_BASE_URL,
  ALIYUN_UPLOAD_POLICY_PATH,
} from "./constants.ts";
import type {
  AliyunPolicyData,
  AliyunPolicyDataRaw,
  AliyunUploaderOptions,
} from "./types.ts";

/**
 * Fetch the DashScope upload policy for `model`.
 *
 * Calls `GET {baseUrl}/api/v1/uploads?action=getPolicy&model={model}` with a
 * Bearer API key. The policy endpoint is rate-limited to 100 QPS per Aliyun
 * main account + model; a 429 is classified as `RATE_LIMITED`, any other
 * non-2xx response as `POLICY_ERROR`.
 */
export async function getUploadPolicy(
  options: AliyunUploaderOptions,
  model: string,
  fetchImpl: typeof globalThis.fetch
): Promise<AliyunPolicyData> {
  const baseUrl = options.baseUrl ?? ALIYUN_UPLOAD_BASE_URL;
  const timeoutMs = options.timeoutMs ?? ALIYUN_DEFAULT_TIMEOUT_MS;
  const url = `${baseUrl}${ALIYUN_UPLOAD_POLICY_PATH}?action=getPolicy&model=${encodeURIComponent(
    model
  )}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.POLICY_ERROR,
      message: "Aliyun upload policy request failed",
      cause,
    });
  }

  if (response.status === 429) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.RATE_LIMITED,
      message:
        "Aliyun upload policy rate limit exceeded (100 QPS per account+model)",
      statusCode: 429,
    });
  }

  if (!response.ok) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.POLICY_ERROR,
      message: `Aliyun upload policy request failed with HTTP ${response.status}`,
      statusCode: response.status,
    });
  }

  const payload = (await response.json()) as { data?: AliyunPolicyDataRaw };
  const data = payload?.data;
  if (
    !data ||
    typeof data.policy !== "string" ||
    typeof data.signature !== "string" ||
    typeof data.upload_dir !== "string" ||
    typeof data.upload_host !== "string" ||
    typeof data.oss_access_key_id !== "string" ||
    typeof data.x_oss_object_acl !== "string" ||
    typeof data.x_oss_forbid_overwrite !== "string"
  ) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.INVALID_RESPONSE,
      message: "Aliyun upload policy response is missing required fields",
    });
  }

  return {
    policy: data.policy,
    signature: data.signature,
    uploadDir: data.upload_dir,
    uploadHost: data.upload_host,
    expireInSeconds: data.expire_in_seconds ?? 0,
    maxFileSizeMb: data.max_file_size_mb,
    capacityLimitMb: data.capacity_limit_mb,
    ossAccessKeyId: data.oss_access_key_id,
    xOssObjectAcl: data.x_oss_object_acl,
    xOssForbidOverwrite: data.x_oss_forbid_overwrite,
  };
}
