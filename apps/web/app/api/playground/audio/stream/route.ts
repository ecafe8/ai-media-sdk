import { streamAudio } from "@ai-media/sdk";
import {
  consumeAudioLimit,
  createAudioProvider,
  errorResponse,
  parseAudioRequest,
  readJson,
  sseEvent,
  toAudioError,
} from "@/lib/playground/audio-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const limited = await consumeAudioLimit(request);
  if (limited) return limited;
  const raw = await readJson(request);
  if (raw instanceof Response) return raw;
  const parsed = parseAudioRequest(raw);
  if (parsed instanceof Response) return parsed;
  try {
    const { instance } = createAudioProvider(parsed);
    const events = streamAudio({
      model: instance,
      text: parsed.text!,
      voice: parsed.voice!,
      providerOptions: parsed.providerOptions,
      signal: request.signal,
    });
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of events) {
            if (request.signal.aborted) break;
            controller.enqueue(sseEvent(event));
            if (event.type === "error" || event.type === "complete") break;
          }
          controller.close();
        } catch (error) {
          if (!request.signal.aborted) {
            controller.enqueue(
              sseEvent({ type: "error", ...toAudioError(error) })
            );
            controller.close();
          } else controller.error(error);
        }
      },
      cancel() {
        // The request signal is also passed to the provider transport.
      },
    });
    return new Response(body, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
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
