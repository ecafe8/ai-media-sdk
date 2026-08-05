import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { ALIYUN_TTL_HOURS } from "./constants.ts";
import { getUploadPolicy } from "./get-policy.ts";
import { uploadFileToOss } from "./upload-oss.ts";
import { UPLOADER_ERROR_CODES, UploaderError } from "../core/index.ts";
import type {
  AliyunUploadParams,
  AliyunUploadedFile,
  AliyunUploader,
  AliyunUploaderOptions,
} from "./types.ts";

/**
 * Create an Aliyun DashScope temporary-file uploader.
 *
 * The uploader performs the three-step DashScope flow (get policy → multipart
 * POST to OSS → `oss://` URL) and returns an {@link AliyunUploadedFile} whose
 * `requiresHeaders` instructs the caller to send `X-DashScope-OssResourceResolve:
 * enable` on the downstream model call. The Aliyun provider adapter injects this
 * header automatically when it detects an `oss://` URL, so callers using the SDK
 * generation API do not need to manage it manually.
 *
 * This is a dev/test convenience: the policy endpoint is rate-limited to 100 QPS
 * per account+model and URLs expire after 48 hours. Use durable OSS for
 * production.
 */
export function createAliyunUploader(
  options: AliyunUploaderOptions
): AliyunUploader {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  return {
    async upload(params: AliyunUploadParams): Promise<AliyunUploadedFile> {
      if (!params.model) {
        throw new UploaderError({
          code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
          message:
            "Aliyun upload requires a model (DashScope binds files to a model)",
        });
      }

      let fileBytes: Uint8Array;
      let fileName: string;
      if (params.filePath) {
        const buffer = await readFile(params.filePath);
        fileBytes = new Uint8Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength
        );
        fileName = params.fileName ?? basename(params.filePath);
      } else if (params.fileBytes) {
        if (!params.fileName) {
          throw new UploaderError({
            code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
            message:
              "Aliyun upload requires fileName when fileBytes is provided",
          });
        }
        fileBytes = params.fileBytes;
        fileName = params.fileName;
      } else {
        throw new UploaderError({
          code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
          message: "Aliyun upload requires either filePath or fileBytes",
        });
      }

      const policyData = await getUploadPolicy(
        options,
        params.model,
        fetchImpl
      );
      const url = await uploadFileToOss(
        policyData,
        fileName,
        fileBytes,
        options.timeoutMs ?? 30_000,
        fetchImpl
      );

      const now = Date.now();
      const expiresAt = new Date(now + ALIYUN_TTL_HOURS * 60 * 60 * 1000);
      return {
        url,
        expiresAt,
        requiresHeaders: { "X-DashScope-OssResourceResolve": "enable" },
      };
    },
  };
}
