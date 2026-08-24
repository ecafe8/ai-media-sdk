import {
  consumeAudioLimit,
  createAliyunProvider,
  errorResponse,
  isRecord,
  readJson,
  toAudioError,
} from "@/lib/playground/audio-api";
import type { PlaygroundRequest } from "@/lib/playground/types";

type Context = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: Context
): Promise<Response> {
  return operation(request, context, "get");
}
export async function PATCH(
  request: Request,
  context: Context
): Promise<Response> {
  return operation(request, context, "update");
}
export async function DELETE(
  request: Request,
  context: Context
): Promise<Response> {
  return operation(request, context, "delete");
}

async function operation(
  request: Request,
  context: Context,
  action: "get" | "update" | "delete"
): Promise<Response> {
  const limited = await consumeAudioLimit(request);
  if (limited) return limited;
  try {
    const body = action === "update" ? await readJson(request) : undefined;
    if (body instanceof Response) return body;
    const query = new URL(request.url).searchParams;
    const protocol =
      query.get("protocol") ?? (isRecord(body) ? body.protocol : null);
    const model =
      query.get("targetModel") ??
      (isRecord(body) && typeof body.targetModel === "string"
        ? body.targetModel
        : "");
    const credentials = isRecord(body) ? body.credentials : undefined;
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
      credentials: credentials as PlaygroundRequest["credentials"],
    }).voiceCloning;
    const { id } = await context.params;
    if (action === "get")
      return Response.json(await manager.get({ protocol, id }));
    if (action === "delete")
      return Response.json(await manager.delete({ protocol, id }));
    if (!isRecord(body) || typeof body.audioUrl !== "string")
      return errorResponse("VALIDATION_ERROR", "audioUrl is required.", 422);
    return Response.json(await manager.update({ id, audioUrl: body.audioUrl }));
  } catch (error) {
    const safe = toAudioError(error);
    return errorResponse(safe.code, safe.message, 422);
  }
}
