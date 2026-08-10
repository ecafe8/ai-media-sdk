import { deleteFile, getFile, listFiles } from "./lifecycle.ts";
import type {
  GoogleUploadedFile,
  GoogleUploader,
  GoogleUploaderOptions,
  GoogleUploadParams,
} from "./types.ts";
import { uploadFile } from "./upload.ts";

/**
 * Create a Google Gemini Files API uploader.
 *
 * `upload` uses the resumable protocol (start → upload+finalize) and returns
 * a {@link GoogleUploadedFile} with a standard `https://` URI. `get`, `list`,
 * and `delete` mirror the Files API lifecycle. Files auto-expire after 48
 * hours; the Gemini Files API is suitable for development use.
 */
export function createGoogleUploader(
  options: GoogleUploaderOptions
): GoogleUploader {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  return {
    async upload(params: GoogleUploadParams): Promise<GoogleUploadedFile> {
      return uploadFile(options, params, fetchImpl);
    },
    async get(name: string): Promise<GoogleUploadedFile> {
      return getFile(options, name, fetchImpl);
    },
    list(): AsyncIterable<GoogleUploadedFile> {
      return listFiles(options, fetchImpl);
    },
    async delete(name: string): Promise<void> {
      await deleteFile(options, name, fetchImpl);
    },
  };
}
