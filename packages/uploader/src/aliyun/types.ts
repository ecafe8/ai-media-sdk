import type { UploadedFile, UploaderOptions } from "../core/index.ts";

export interface AliyunUploaderOptions extends UploaderOptions {
  /** Override the default `https://dashscope.aliyuncs.com` base URL. */
  readonly baseUrl?: string;
}

/**
 * Input to {@link AliyunUploader.upload}. DashScope binds each uploaded file
 * to a single model, so `model` is required and MUST match the model used in
 * the downstream generation call. Provide either a local `filePath` (read via
 * Node `fs`) or in-memory `fileBytes` plus `fileName`.
 */
export interface AliyunUploadParams {
  readonly model: string;
  readonly filePath?: string;
  readonly fileBytes?: Uint8Array;
  readonly fileName?: string;
  readonly mimeType?: string;
}

/**
 * Policy data returned by the DashScope get-policy endpoint, mapped from the
 * upstream snake_case shape to camelCase.
 */
export interface AliyunPolicyData {
  readonly policy: string;
  readonly signature: string;
  readonly uploadDir: string;
  readonly uploadHost: string;
  readonly expireInSeconds: number;
  readonly maxFileSizeMb?: number;
  readonly capacityLimitMb?: number;
  readonly ossAccessKeyId: string;
  readonly xOssObjectAcl: string;
  readonly xOssForbidOverwrite: string;
}

/**
 * Raw shape of the DashScope get-policy response `data` field, used for
 * runtime validation before mapping to {@link AliyunPolicyData}.
 */
export interface AliyunPolicyDataRaw {
  readonly policy?: string;
  readonly signature?: string;
  readonly upload_dir?: string;
  readonly upload_host?: string;
  readonly expire_in_seconds?: number;
  readonly max_file_size_mb?: number;
  readonly capacity_limit_mb?: number;
  readonly oss_access_key_id?: string;
  readonly x_oss_object_acl?: string;
  readonly x_oss_forbid_overwrite?: string;
}

/**
 * Upload result returned by the Aliyun uploader. The `oss://` URL requires the
 * `X-DashScope-OssResourceResolve: enable` header on every downstream model
 * call that references it; the Aliyun provider adapter injects this header
 * automatically when it detects an `oss://` URL.
 */
export interface AliyunUploadedFile extends UploadedFile {
  readonly url: string;
  readonly expiresAt: Date;
  readonly requiresHeaders: { "X-DashScope-OssResourceResolve": "enable" };
}

export interface AliyunUploader {
  upload(params: AliyunUploadParams): Promise<AliyunUploadedFile>;
}
