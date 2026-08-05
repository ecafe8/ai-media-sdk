import { ALIYUN_DEFAULT_TIMEOUT_MS } from "./constants.ts";
import { UPLOADER_ERROR_CODES, UploaderError } from "../core/index.ts";
import type { AliyunPolicyData } from "./types.ts";

/**
 * POST the file bytes to the DashScope temporary OSS host as
 * `multipart/form-data`, following Aliyun's documented field order (the
 * `file` field MUST be last). Returns the canonical `oss://{key}` URL.
 *
 * The form fields are: `OSSAccessKeyId`, `Signature`, `policy`,
 * `x-oss-object-acl`, `x-oss-forbid-overwrite`, `key`, `success_action_status`,
 * `file`. A non-200 response is classified as `UPLOAD_ERROR`.
 */
export async function uploadFileToOss(
  policyData: AliyunPolicyData,
  fileName: string,
  fileBytes: Uint8Array,
  timeoutMs: number,
  fetchImpl: typeof globalThis.fetch
): Promise<string> {
  const key = `${policyData.uploadDir}/${fileName}`;
  const form = new FormData();
  form.set("OSSAccessKeyId", policyData.ossAccessKeyId);
  form.set("Signature", policyData.signature);
  form.set("policy", policyData.policy);
  form.set("x-oss-object-acl", policyData.xOssObjectAcl);
  form.set("x-oss-forbid-overwrite", policyData.xOssForbidOverwrite);
  form.set("key", key);
  form.set("success_action_status", "200");
  form.set("file", new Blob([fileBytes], {}), fileName);

  let response: Response;
  try {
    response = await fetchImpl(policyData.uploadHost, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.UPLOAD_ERROR,
      message: "Aliyun OSS upload request failed",
      cause,
    });
  }

  if (response.status !== 200) {
    throw new UploaderError({
      code: UPLOADER_ERROR_CODES.UPLOAD_ERROR,
      message: `Aliyun OSS upload failed with HTTP ${response.status}`,
      statusCode: response.status,
    });
  }

  return `oss://${key}`;
}

/** Default timeout re-export for the index module. */
export const DEFAULT_TIMEOUT_MS = ALIYUN_DEFAULT_TIMEOUT_MS;
