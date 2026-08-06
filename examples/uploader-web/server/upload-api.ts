import type { Plugin, ViteDevServer } from "vite";

import { createAliyunUploader } from "@ai-media/uploader/aliyun";
import { createGoogleUploader } from "@ai-media/uploader/google";
import {
  UPLOADER_ERROR_CODES,
  UploaderError,
  type UploadedFile,
} from "@ai-media/uploader/core";

/**
 * Dev-only Vite plugin that exposes two server-side upload endpoints so the
 * browser can drive Aliyun DashScope and Google Gemini temporary-file uploads
 * without exposing API keys (held in `process.env`) and without hitting Aliyun
 * CORS (the OSS host does not send CORS headers for browser origins).
 *
 *   POST /api/upload/aliyun   multipart: file, model            -> UploadedFile
 *   POST /api/upload/google   multipart: file, mimeType[, displayName] -> UploadedFile
 *
 * Both routes read the API key from `process.env`, call the
 * `@ai-media/uploader` package server-side, and return a sanitized JSON
 * response. Errors are returned as `{ code, message }` without leaking the
 * API key. Only mounted during `vite dev` (configureServer); production
 * serving requires a separate server and is out of scope for this example.
 */

const ALIYUN_API_KEY_ENV = "ALIYUN_BAILIAN_API_KEY";
const GOOGLE_API_KEY_ENV = "GEMINI_API_KEY";

export interface UploadApiEnv {
  readonly ALIYUN_BAILIAN_API_KEY?: string;
  readonly GEMINI_API_KEY?: string;
}

interface ApiErrorBody {
  readonly code: string;
  readonly message: string;
}

function json(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function errorBody(error: unknown): { status: number; body: ApiErrorBody } {
  if (error instanceof UploaderError) {
    return {
      status: error.statusCode
        ? Math.floor(error.statusCode / 100) === 4
          ? 400
          : 500
        : 500,
      body: { code: error.code, message: error.message },
    };
  }
  const message =
    error instanceof Error ? error.message : "Upload failed unexpectedly";
  return { status: 500, body: { code: UPLOADER_ERROR_CODES.UNKNOWN, message } };
}

/** Read the raw request body into a Uint8Array (used to build a Web Request). */
function readBody(
  req: import("node:http").IncomingMessage
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(
        new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      );
    });
    req.on("error", reject);
  });
}

/** Convert a Node IncomingMessage into a Web Request so we can use formData(). */
async function toWebRequest(
  req: import("node:http").IncomingMessage
): Promise<Request> {
  const protocol = "http";
  const host = req.headers.host ?? "localhost";
  const url = `${protocol}://${host}${req.url ?? ""}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value))
      for (const item of value) headers.append(key, item);
  }
  const body = await readBody(req);
  return new Request(url, {
    method: req.method ?? "POST",
    headers,
    body: body.byteLength > 0 ? (body as unknown as BodyInit) : undefined,
  });
}

async function handleAliyunUpload(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  env: UploadApiEnv
): Promise<void> {
  const apiKey = env[ALIYUN_API_KEY_ENV as keyof UploadApiEnv];
  if (!apiKey) {
    return json(res, 503, {
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
      message: `Missing ${ALIYUN_API_KEY_ENV} environment variable. Configure .env before uploading.`,
    });
  }

  let formData: FormData;
  try {
    const request = await toWebRequest(req);
    formData = await request.formData();
  } catch {
    return json(res, 400, {
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
      message: "Invalid multipart form data",
    });
  }

  const model = formData.get("model");
  const file = formData.get("file");
  if (typeof model !== "string" || model.length === 0) {
    return json(res, 400, {
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
      message: "Missing 'model' field (DashScope binds files to a model)",
    });
  }
  if (!(file instanceof Blob)) {
    return json(res, 400, {
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
      message: "Missing 'file' field",
    });
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const fileName = file.name || "upload.bin";
  const mimeType = file.type || undefined;

  let result: UploadedFile;
  try {
    result = await createAliyunUploader({ apiKey }).upload({
      model,
      fileBytes,
      fileName,
      ...(mimeType ? { mimeType } : {}),
    });
  } catch (error) {
    const { status, body } = errorBody(error);
    return json(res, status, body);
  }
  return json(res, 200, result);
}

async function handleGoogleUpload(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  env: UploadApiEnv
): Promise<void> {
  const apiKey = env[GOOGLE_API_KEY_ENV as keyof UploadApiEnv];
  if (!apiKey) {
    return json(res, 503, {
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
      message: `Missing ${GOOGLE_API_KEY_ENV} environment variable. Configure .env before uploading.`,
    });
  }

  let formData: FormData;
  try {
    const request = await toWebRequest(req);
    formData = await request.formData();
  } catch {
    return json(res, 400, {
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
      message: "Invalid multipart form data",
    });
  }

  const mimeType = formData.get("mimeType");
  const file = formData.get("file");
  const displayName = formData.get("displayName");
  if (typeof mimeType !== "string" || mimeType.length === 0) {
    return json(res, 400, {
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
      message: "Missing 'mimeType' field (required by Gemini Files API)",
    });
  }
  if (!(file instanceof Blob)) {
    return json(res, 400, {
      code: UPLOADER_ERROR_CODES.INVALID_REQUEST,
      message: "Missing 'file' field",
    });
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const fileName = file.name || "upload.bin";

  let result: UploadedFile;
  try {
    result = await createGoogleUploader({ apiKey }).upload({
      fileBytes,
      fileName,
      mimeType,
      ...(typeof displayName === "string" && displayName.length > 0
        ? { displayName }
        : {}),
    });
  } catch (error) {
    const { status, body } = errorBody(error);
    return json(res, status, body);
  }
  return json(res, 200, result);
}

export function uploadApiPlugin(env: UploadApiEnv): Plugin {
  return {
    name: "uploader-web/upload-api",
    configureServer(server: ViteDevServer) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.method !== "POST") return next();
          try {
            if (req.url === "/api/upload/aliyun") {
              return await handleAliyunUpload(req, res, env);
            }
            if (req.url === "/api/upload/google") {
              return await handleGoogleUpload(req, res, env);
            }
          } catch (error) {
            const { status, body } = errorBody(error);
            return json(res, status, body);
          }
          return next();
        });
      };
    },
  };
}
