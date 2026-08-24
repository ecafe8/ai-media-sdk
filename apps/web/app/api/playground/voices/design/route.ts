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
  const limited = await consumeAudioLimit(request);
  if (limited) return limited;
  try {
    const value = await readJson(request);
    if (value instanceof Response) return value;
    if (
      !isRecord(value) ||
      (value.protocol !== "qwen-audio" && value.protocol !== "qwen") ||
      typeof value.targetModel !== "string" ||
      typeof value.voicePrompt !== "string" ||
      typeof value.previewText !== "string"
    )
      return errorResponse(
        "VALIDATION_ERROR",
        "protocol, targetModel, voicePrompt, and previewText are required.",
        422
      );
    const manager = createAliyunProvider({
      provider: "aliyun-bailian",
      model: value.targetModel,
      modality: "audio",
      prompt: "",
      text: "voice",
      voice: "voice",
      credentials: value.credentials as PlaygroundRequest["credentials"],
    }).voiceDesign;
    return Response.json(
      await manager.create({
        protocol: value.protocol,
        targetModel: value.targetModel,
        voicePrompt: value.voicePrompt,
        previewText: value.previewText,
        ...(typeof value.prefix === "string" ? { prefix: value.prefix } : {}),
        ...(typeof value.preferredName === "string"
          ? { preferredName: value.preferredName }
          : {}),
        ...(typeof value.language === "string"
          ? { language: value.language }
          : {}),
        ...(typeof value.sampleRate === "number"
          ? { sampleRate: value.sampleRate }
          : {}),
        ...(typeof value.responseFormat === "string"
          ? {
              responseFormat: value.responseFormat as
                | "pcm"
                | "wav"
                | "mp3"
                | "opus",
            }
          : {}),
      })
    );
  } catch (error) {
    const safe = toAudioError(error);
    return errorResponse(safe.code, safe.message, 422);
  }
}

export async function GET(request: Request): Promise<Response> {
  const limited = await consumeAudioLimit(request);
  if (limited) return limited;
  try {
    const params = new URL(request.url).searchParams;
    const protocol = params.get("protocol");
    const model = params.get("targetModel");
    if ((protocol !== "qwen-audio" && protocol !== "qwen") || !model)
      return errorResponse(
        "VALIDATION_ERROR",
        "protocol and targetModel are required.",
        422
      );
    const manager = createAliyunProvider({
      provider: "aliyun-bailian",
      model,
      modality: "audio",
      prompt: "",
      text: "voice",
      voice: "voice",
    }).voiceDesign;
    return Response.json(
      await manager.list({
        protocol,
        pageIndex: Number(params.get("pageIndex") ?? 0),
        pageSize: Number(params.get("pageSize") ?? 20),
      })
    );
  } catch (error) {
    const safe = toAudioError(error);
    return errorResponse(safe.code, safe.message, 422);
  }
}

export async function PATCH(): Promise<Response> {
  return errorResponse(
    "INVALID_REQUEST",
    "Designed voices cannot be updated.",
    405
  );
}
