import {
  consumeAudioLimit,
  createAliyunProvider,
  errorResponse,
  toAudioError,
} from "@/lib/playground/audio-api";

type Context = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: Context
): Promise<Response> {
  return operation(request, context, "get");
}
export async function DELETE(
  request: Request,
  context: Context
): Promise<Response> {
  return operation(request, context, "delete");
}
export async function PATCH(): Promise<Response> {
  return errorResponse(
    "INVALID_REQUEST",
    "Designed voices cannot be updated.",
    405
  );
}

async function operation(
  request: Request,
  context: Context,
  action: "get" | "delete"
): Promise<Response> {
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
    const { id } = await context.params;
    return Response.json(
      await (action === "get"
        ? manager.get({ protocol, id })
        : manager.delete({ protocol, id }))
    );
  } catch (error) {
    const safe = toAudioError(error);
    return errorResponse(safe.code, safe.message, 422);
  }
}
