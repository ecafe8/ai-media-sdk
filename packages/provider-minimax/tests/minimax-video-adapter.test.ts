/// <reference types="bun" />

import { describe, expect, test } from "bun:test";
import { createMiniMaxProvider } from "@ai-media/provider-minimax";
import { SdkError, submitVideoTask } from "@ai-media/sdk";

import {
  createFakeTransport,
  transportResponse,
  transportTimeout,
} from "./helpers/fake-transport.js";

const MINIMAX_CONFIG = {
  apiKey: "test-key",
  baseUrl: "https://api.minimax.io",
};

const H3 = "MiniMax-H3";

const BASE_OPTIONS = {
  minimax: {
    resolution: "2K" as const,
    duration: 5 as const,
    ratio: "16:9" as const,
  },
};

function submitResponse(taskId = "task-1") {
  return transportResponse(200, { task_id: taskId });
}

function taskResponse(status: string, extra: Record<string, unknown> = {}) {
  return transportResponse(200, {
    task: {
      id: "task-1",
      model: H3,
      status,
      resolution: "2K",
      duration: 5,
      usage: {
        total_seconds: 5,
        input_seconds: 0,
        output_seconds: 5,
        input_image_count: 0,
      },
      ...extra,
    },
  });
}

function oaiError(status: number, type: string, message: string) {
  return transportResponse(status, {
    type: "error",
    error: { type, message, http_code: String(status) },
    request_id: "req-1",
  });
}

const WAIT_OPTS = { pollIntervalMs: 0, timeoutMs: 5000 };

function bodyOf(requests: { body?: unknown }[]): Record<string, unknown> {
  return requests[0]!.body as Record<string, unknown>;
}

function contentOf(
  body: Record<string, unknown>
): Array<Record<string, unknown>> {
  return body.content as Array<Record<string, unknown>>;
}

describe("minimax video adapter", () => {
  test("video() binds MiniMax-H3 with video + async capabilities", () => {
    const { transport } = createFakeTransport([submitResponse()]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const model = provider.video(H3);
    expect(model.modelId).toBe(H3);
    expect(model.providerId).toBe("minimax");
    expect(model.capabilities.modality).toBe("video");
    expect(model.capabilities.async).toBe(true);
    expect(model.capabilities.edit).toBe(false);

    const listed = provider.listModels();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(H3);
    expect(listed[0]?.modality).toBe("video");
  });

  test("video() rejects an unknown model with UNKNOWN_MODEL before transport", () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const error = (() => {
      try {
        provider.video("not-a-real-model");
      } catch (e) {
        return e as SdkError;
      }
      throw new Error("expected throw");
    })();
    expect(error).toBeInstanceOf(SdkError);
    expect(error.code).toBe("UNKNOWN_MODEL");
    expect(requests).toHaveLength(0);
  });

  test("synchronous generate/edit fail with NOT_IMPLEMENTED", async () => {
    const { transport } = createFakeTransport([submitResponse()]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });
    const request = {
      provider: "minimax",
      model: H3,
      modality: "video" as const,
      input: {},
    };

    const generateError = (await provider
      .generate(request)
      .catch((e: unknown) => e)) as SdkError;
    expect(generateError.code).toBe("NOT_IMPLEMENTED");

    const editError = (await provider
      .edit(request)
      .catch((e: unknown) => e)) as SdkError;
    expect(editError.code).toBe("NOT_IMPLEMENTED");
  });

  test("builds the t2v submit request with a single text content item", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("succeeded", {
        content: { url: "https://x/v.mp4" },
      }),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });
    const model = provider.video(H3);

    const task = await submitVideoTask({
      model,
      prompt: "A boy playing basketball by the sea",
      providerOptions: BASE_OPTIONS,
    });
    await task.wait(WAIT_OPTS);

    const request = requests[0]!;
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://api.minimax.io/v2/video_generation");
    const headers = request.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = bodyOf(requests);
    expect(body.model).toBe(H3);
    expect(body.resolution).toBe("2K");
    expect(body.duration).toBe(5);
    expect(body.ratio).toBe("16:9");
    expect(body.callback_url).toBeUndefined();
    const content = contentOf(body);
    expect(content).toHaveLength(1);
    expect(content[0]!.type).toBe("text");
    expect(content[0]!.text).toBe("A boy playing basketball by the sea");
  });

  test("defaults to the global base URL and normalizes trailing slashes", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("succeeded", { content: { url: "https://x/v.mp4" } }),
      submitResponse("task-2"),
      taskResponse("succeeded", { content: { url: "https://x/v.mp4" } }),
    ]);
    const provider = createMiniMaxProvider(
      { apiKey: "test-key" },
      { transport }
    );

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    });
    await task.wait(WAIT_OPTS);

    expect(requests[0]!.url).toBe("https://api.minimax.io/v2/video_generation");
    expect(requests[1]!.url).toBe(
      "https://api.minimax.io/v2/query/video_generation/task-1"
    );

    const slashed = createMiniMaxProvider(
      { apiKey: "test-key", baseUrl: "https://proxy.example.com/" },
      { transport }
    );
    await submitVideoTask({
      model: slashed.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    }).then((handle) => handle.wait(WAIT_OPTS));
    expect(requests[2]!.url).toBe(
      "https://proxy.example.com/v2/video_generation"
    );
  });

  test("forwards callback_url when supplied", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("succeeded", { content: { url: "https://x/v.mp4" } }),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: {
        minimax: { ...BASE_OPTIONS.minimax, callbackUrl: "https://cb/x" },
      },
    });
    await task.wait(WAIT_OPTS);

    expect(bodyOf(requests).callback_url).toBe("https://cb/x");
  });

  test("builds the i2v body with a first_frame image and forces adaptive ratio", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("succeeded", { content: { url: "https://x/v.mp4" } }),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "Pull focus to the background",
      firstFrame: { url: "https://example.com/first.png" },
      providerOptions: {
        minimax: { resolution: "768P", duration: 6, ratio: "16:9" },
      },
    });
    await task.wait(WAIT_OPTS);

    const body = bodyOf(requests);
    expect(body.ratio).toBe("adaptive");
    const content = contentOf(body);
    expect(content).toHaveLength(2);
    expect(content[1]!.type).toBe("image_url");
    expect(content[1]!.role).toBe("first_frame");
    expect((content[1]!.image_url as Record<string, unknown>).url).toBe(
      "https://example.com/first.png"
    );
  });

  test("builds first & last frame i2v content", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("succeeded", { content: { url: "https://x/v.mp4" } }),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "Transition between frames",
      firstFrame: { url: "https://example.com/first.png" },
      lastFrame: { url: "https://example.com/last.png" },
      providerOptions: BASE_OPTIONS,
    });
    await task.wait(WAIT_OPTS);

    const content = contentOf(bodyOf(requests));
    expect(content).toHaveLength(3);
    expect(content[1]!.role).toBe("first_frame");
    expect(content[2]!.role).toBe("last_frame");
    expect((content[2]!.image_url as Record<string, unknown>).url).toBe(
      "https://example.com/last.png"
    );
  });

  test("maps base64 frames and reference images to data URIs", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("succeeded", { content: { url: "https://x/v.mp4" } }),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      firstFrame: { base64: "aGVsbG8=", mimeType: "image/jpeg" },
      providerOptions: BASE_OPTIONS,
    });
    await task.wait(WAIT_OPTS);

    const content = contentOf(bodyOf(requests));
    expect((content[1]!.image_url as Record<string, unknown>).url).toBe(
      "data:image/jpeg;base64,aGVsbG8="
    );
  });

  test("builds r2v content with image/video/audio references and defaults ratio to adaptive", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("succeeded", { content: { url: "https://x/v.mp4" } }),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "Character speaks: follow the wind",
      referenceImages: [
        { url: "https://example.com/ref-1.png" },
        { url: "https://example.com/ref-2.png" },
      ],
      referenceVideos: [{ url: "https://example.com/ref.mp4", duration: 4 }],
      referenceAudios: [{ url: "https://example.com/ref.mp3", duration: 3 }],
      providerOptions: { minimax: { resolution: "2K", duration: 5 } },
    });
    await task.wait(WAIT_OPTS);

    const body = bodyOf(requests);
    expect(body.ratio).toBe("adaptive");
    const content = contentOf(body);
    expect(content).toHaveLength(5);
    expect(content[1]!.role).toBe("reference_image");
    expect(content[2]!.role).toBe("reference_image");
    expect(content[3]!.type).toBe("video_url");
    expect(content[3]!.role).toBe("reference_video");
    expect((content[3]!.video_url as Record<string, unknown>).url).toBe(
      "https://example.com/ref.mp4"
    );
    expect(content[4]!.type).toBe("audio_url");
    expect(content[4]!.role).toBe("reference_audio");
    expect((content[4]!.audio_url as Record<string, unknown>).url).toBe(
      "https://example.com/ref.mp3"
    );
  });

  test("accepts an explicit r2v ratio from the documented set", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("succeeded", { content: { url: "https://x/v.mp4" } }),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      referenceImages: [{ url: "https://example.com/ref-1.png" }],
      providerOptions: {
        minimax: { resolution: "2K", duration: 5, ratio: "9:16" },
      },
    });
    await task.wait(WAIT_OPTS);

    expect(bodyOf(requests).ratio).toBe("9:16");
  });

  test("polls queued -> running -> succeeded and resolves with the video url", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("queued"),
      taskResponse("running"),
      taskResponse("succeeded", {
        content: { url: "https://x/v.mp4" },
      }),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    });
    const result = await task.wait(WAIT_OPTS);

    expect(result.provider).toBe("minimax");
    expect(result.model).toBe(H3);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.url).toBe("https://x/v.mp4");
    expect(result.content[0]?.duration).toBe(5);
    expect(result.raw).toMatchObject({ total_seconds: 5 });
    // 1 submit POST + 3 polls (queued, running, succeeded).
    expect(requests).toHaveLength(4);
    expect(requests[1]!.method).toBe("GET");
    const headers = requests[1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(requests[1]!.url).toBe(
      "https://api.minimax.io/v2/query/video_generation/task-1"
    );
  });

  test("rejects when the task ends failed with the provider error message", async () => {
    const { transport } = createFakeTransport([
      submitResponse(),
      taskResponse("failed", {
        error: { code: "1026", message: "sensitive content" },
      }),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    });
    const error = (await task
      .wait(WAIT_OPTS)
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.message).toContain("1026");
    expect(error.message).toContain("sensitive content");
    expect(error.message).not.toContain("test-key");
  });

  test("rejects when the task ends cancelled", async () => {
    const { transport } = createFakeTransport([
      submitResponse(),
      taskResponse("cancelled"),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    });
    const error = (await task
      .wait(WAIT_OPTS)
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.message).toBe("MiniMax video task failed");
  });

  test("maps an unknown task status to a terminal failure", async () => {
    const { transport } = createFakeTransport([
      submitResponse(),
      taskResponse("mystery-state"),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    });
    const error = (await task
      .wait(WAIT_OPTS)
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
  });

  test("fails as PROVIDER_ERROR when a succeeded task has no video url", async () => {
    const { transport } = createFakeTransport([
      submitResponse(),
      taskResponse("succeeded"),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    });
    const error = (await task
      .wait(WAIT_OPTS)
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.message).toContain("no video url");
  });

  test("fails as PROVIDER_ERROR when submit returns no task id", async () => {
    const { transport } = createFakeTransport([transportResponse(200, {})]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const error = (await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    }).catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.message).toContain("no task id");
  });

  test("classifies submit 401 as non-retryable AUTH_ERROR without leaking the key", async () => {
    const { transport } = createFakeTransport([
      oaiError(
        401,
        "authorized_error",
        "login fail: carry the API secret key test-key in Authorization (1004)"
      ),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const error = (await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    }).catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("AUTH_ERROR");
    expect(error.retryable).toBe(false);
    expect(error.message).not.toContain("test-key");
    expect(error.message).toContain("[redacted]");
  });

  test("classifies submit 402 as non-retryable PROVIDER_ERROR", async () => {
    const { transport } = createFakeTransport([
      oaiError(
        402,
        "insufficient_balance_error",
        "insufficient balance (1008)"
      ),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const error = (await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    }).catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("insufficient balance");
  });

  test("classifies submit 422 sensitive content as INVALID_REQUEST", async () => {
    const { transport } = createFakeTransport([
      oaiError(
        422,
        "unprocessable_entity_error",
        "video description contains sensitive content (1026)"
      ),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const error = (await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    }).catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("INVALID_REQUEST");
    expect(error.retryable).toBe(false);
  });

  test("classifies submit 429 as retryable RATE_LIMITED", async () => {
    const { transport } = createFakeTransport([
      oaiError(
        429,
        "rate_limit_error",
        "rate limit, please retry later (1002)"
      ),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const error = (await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    }).catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryable).toBe(true);
  });

  test("classifies submit 5xx as PROVIDER_ERROR", async () => {
    const { transport } = createFakeTransport([
      oaiError(500, "server_error", "internal error (1000)"),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const error = (await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    }).catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
  });

  test("classifies poll errors with the same rules", async () => {
    const { transport } = createFakeTransport([
      submitResponse(),
      oaiError(401, "authorized_error", "expired key"),
    ]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    });
    const error = (await task
      .wait(WAIT_OPTS)
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("AUTH_ERROR");
  });

  test("maps a transport timeout to TIMEOUT", async () => {
    const { transport } = createFakeTransport([transportTimeout()]);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const error = (await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: BASE_OPTIONS,
    }).catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("TIMEOUT");
    expect(error.retryable).toBe(true);
    expect(error.message).not.toContain("test-key");
  });
});
