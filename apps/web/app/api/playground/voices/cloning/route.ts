import {
  consumeAudioLimit,
  createAliyunProvider,
  errorResponse,
  isRecord,
  readJson,
  toAudioError,
} from "@/lib/playground/audio-api";
import type { PlaygroundRequest } from "@/lib/playground/types";

export async function POST(request: Request): Promise<Response> {
  return run(request, "create");
}

export async function GET(request: Request): Promise<Response> {
  return run(request, "list");
}

async function run(
  request: Request,
  operation: "create" | "list"
): Promise<Response> {
  const limited = await consumeAudioLimit(request);
  if (limited) return limited;
  try {
    const value =
      operation === "create" ? await readJson(request) : query(request);
    if (value instanceof Response) return value;
    if (!isRecord(value))
      return errorResponse("VALIDATION_ERROR", "Invalid voice request.", 422);
    const protocol = value.protocol;
    const targetModel = value.targetModel;
    if (
      (protocol !== "qwen-audio" && protocol !== "qwen") ||
      typeof targetModel !== "string" ||
      !targetModel
    ) {
      return errorResponse(
        "VALIDATION_ERROR",
        "protocol and targetModel are required.",
        422
      );
    }
    const playgroundRequest = providerRequest(targetModel, value.credentials);
    const manager = createAliyunProvider(playgroundRequest).voiceCloning;
    if (operation === "list") {
      return Response.json(
        await manager.list({
          protocol,
          ...(typeof value.prefix === "string" ? { prefix: value.prefix } : {}),
          ...numberOption(value.pageIndex, "pageIndex"),
          ...numberOption(value.pageSize, "pageSize"),
        })
      );
    }
    return Response.json(
      await manager.create({
        protocol,
        targetModel,
        ...(typeof value.audioUrl === "string"
          ? { audioUrl: value.audioUrl }
          : {}),
        ...(isRecord(value.audio) && typeof value.audio.data === "string"
          ? { audio: { data: value.audio.data } }
          : {}),
        ...(typeof value.text === "string" ? { text: value.text } : {}),
        ...(typeof value.prefix === "string" ? { prefix: value.prefix } : {}),
        ...(typeof value.preferredName === "string"
          ? { preferredName: value.preferredName }
          : {}),
        ...(Array.isArray(value.languageHints)
          ? {
              languageHints: value.languageHints.filter(
                (item): item is string => typeof item === "string"
              ),
            }
          : {}),
        ...(typeof value.language === "string"
          ? { language: value.language }
          : {}),
      })
    );
  } catch (error) {
    const safe = toAudioError(error);
    return errorResponse(safe.code, safe.message, 422);
  }
}

function query(request: Request): Record<string, unknown> {
  const params = new URL(request.url).searchParams;
  return {
    protocol: params.get("protocol"),
    targetModel: params.get("targetModel"),
    prefix: params.get("prefix") ?? undefined,
    pageIndex: params.get("pageIndex")
      ? Number(params.get("pageIndex"))
      : undefined,
    pageSize: params.get("pageSize")
      ? Number(params.get("pageSize"))
      : undefined,
  };
}

function numberOption(value: unknown, name: string): Record<string, number> {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? { [name]: value }
    : {};
}

function providerRequest(
  model: string,
  credentials: unknown
): PlaygroundRequest {
  return {
    provider: "aliyun-bailian",
    model,
    modality: "audio",
    prompt: "",
    text: "voice",
    voice: "voice",
    credentials: credentials as PlaygroundRequest["credentials"],
  };
}
