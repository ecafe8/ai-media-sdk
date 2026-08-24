import {
  consumeAudioLimit,
  createUploader,
  errorResponse,
  MAX_AUDIO_UPLOAD_BYTES,
  toAudioError,
} from "@/lib/playground/audio-api";

export async function POST(request: Request): Promise<Response> {
  const limited = await consumeAudioLimit(request);
  if (limited) return limited;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const model = form.get("model");
    const credentialsValue = form.get("credentials");
    if (
      !(file instanceof File) ||
      typeof model !== "string" ||
      model.trim() === ""
    ) {
      return errorResponse(
        "VALIDATION_ERROR",
        "A file and target model are required.",
        422
      );
    }
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      return errorResponse(
        "VALIDATION_ERROR",
        "The audio file exceeds the 100 MiB limit.",
        413
      );
    }
    const extension = file.name.toLowerCase().split(".").pop();
    if (!extension || !["wav", "mp3", "m4a"].includes(extension)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Only wav, mp3, and m4a audio files are supported.",
        422
      );
    }
    const credentials =
      credentialsValue === null
        ? undefined
        : JSON.parse(String(credentialsValue));
    const upload = createUploader({
      provider: "aliyun-bailian",
      model,
      modality: "audio",
      prompt: "",
      credentials,
    });
    const result = await upload.upload({
      model,
      fileBytes: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name,
      mimeType: file.type,
    });
    return Response.json({
      status: "succeeded",
      ...result,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (error) {
    const safe = toAudioError(error);
    return errorResponse(
      safe.code,
      safe.message,
      safe.code === "CONFIGURATION_ERROR" ? 422 : 400
    );
  }
}
