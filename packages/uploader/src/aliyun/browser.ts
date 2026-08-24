import { UPLOADER_ERROR_CODES, UploaderError } from "../core/index.ts";
import { ALIYUN_TTL_HOURS } from "./constants.ts";
import { getUploadPolicy } from "./get-policy.ts";
import type {
  AliyunUploadedFile,
  AliyunUploader,
  AliyunUploaderOptions,
  AliyunUploadParams,
} from "./types.ts";
import { uploadFileToOss } from "./upload-oss.ts";

const MAX_AUDIO_FILE_BYTES = 100 * 1024 * 1024;
const AUDIO_EXTENSIONS = new Set(["wav", "mp3", "m4a"]);
const AUDIO_MIME_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
]);

export type AliyunBrowserUploadParams = Omit<AliyunUploadParams, "filePath"> & {
  readonly model: string;
  readonly fileBytes: Uint8Array;
  readonly fileName: string;
};

/** Browser-safe Aliyun uploader for model-bound temporary audio files. */
export function createAliyunBrowserUploader(
  options: AliyunUploaderOptions
): Pick<AliyunUploader, "upload"> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  return {
    async upload(
      params: AliyunBrowserUploadParams
    ): Promise<AliyunUploadedFile> {
      validateAudioUpload(params);
      const policyData = await getUploadPolicy(
        options,
        params.model,
        fetchImpl
      );
      const maxPolicyBytes =
        (policyData.maxFileSizeMb ?? Infinity) * 1024 * 1024;
      if (params.fileBytes.byteLength > maxPolicyBytes) {
        throw invalid("Aliyun audio file exceeds the policy size limit");
      }
      const url = await uploadFileToOss(
        policyData,
        params.fileName,
        params.fileBytes,
        options.timeoutMs ?? 30_000,
        fetchImpl
      );
      return {
        url,
        expiresAt: new Date(Date.now() + ALIYUN_TTL_HOURS * 60 * 60 * 1000),
        requiresHeaders: { "X-DashScope-OssResourceResolve": "enable" },
      };
    },
  };
}

function validateAudioUpload(params: AliyunBrowserUploadParams): void {
  if (!params.model.trim()) throw invalid("Aliyun upload requires a model");
  if (
    !params.fileName.trim() ||
    /[\\/]/.test(params.fileName) ||
    [...params.fileName].some((character) => character.charCodeAt(0) < 32)
  ) {
    throw invalid("Aliyun upload requires a safe fileName");
  }
  const extension = params.fileName.toLowerCase().split(".").pop();
  if (!extension || !AUDIO_EXTENSIONS.has(extension)) {
    throw invalid("Only wav, mp3, and m4a audio files are supported");
  }
  if (params.mimeType && !AUDIO_MIME_TYPES.has(params.mimeType.toLowerCase())) {
    throw invalid("The audio MIME type is not supported");
  }
  if (params.fileBytes.byteLength > MAX_AUDIO_FILE_BYTES) {
    throw invalid("Aliyun audio file exceeds the 100 MiB limit");
  }
}

function invalid(message: string): UploaderError {
  return new UploaderError({
    code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
    message,
  });
}
