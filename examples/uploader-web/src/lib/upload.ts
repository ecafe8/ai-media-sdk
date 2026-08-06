export type UploadProvider = "aliyun" | "google";

/**
 * Upload result returned by the dev-server middleware, mirroring the
 * `UploadedFile` contract from `@ai-media/uploader/core` (dates serialized as
 * ISO strings over JSON).
 */
export interface UploadedFile {
  readonly url: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
  readonly expiresAt?: string;
  readonly requiresHeaders?: Record<string, string>;
  readonly name?: string;
  readonly state?: string;
}

export class UploadClientError extends Error {
  readonly code: string;
  readonly statusCode: number;
  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "UploadClientError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

async function postUpload(url: string, form: FormData): Promise<UploadedFile> {
  const res = await fetch(url, { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as {
    code?: string;
    message?: string;
  } | null;
  if (!res.ok || !data || typeof (data as { url?: unknown }).url !== "string") {
    throw new UploadClientError(
      data?.code ?? "UNKNOWN",
      data?.message ?? `Upload request failed with HTTP ${res.status}`,
      res.status
    );
  }
  return data as unknown as UploadedFile;
}

export function uploadToAliyun(
  file: File,
  model: string
): Promise<UploadedFile> {
  const form = new FormData();
  form.set("model", model);
  form.set("file", file);
  return postUpload("/api/upload/aliyun", form);
}

export function uploadToGoogle(
  file: File,
  mimeType: string,
  displayName?: string
): Promise<UploadedFile> {
  const form = new FormData();
  form.set("mimeType", mimeType);
  form.set("file", file);
  if (displayName) form.set("displayName", displayName);
  return postUpload("/api/upload/google", form);
}
