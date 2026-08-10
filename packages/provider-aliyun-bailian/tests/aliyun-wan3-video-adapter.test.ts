/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import {
  SdkError,
  submitVideoTask,
  type VideoGenerationRequest,
  type Wan3VideoMediaEntry,
} from "@ai-media/sdk";
import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";

import {
  createFakeTransport,
  transportResponse,
  transportTimeout,
} from "./helpers/fake-transport.js";

const ALIYUN_CONFIG = {
  apiKey: "test-key",
  baseUrl: "https://ws-id.cn-beijing.maas.aliyuncs.com/api/v1",
};

const WAN3 = "wan3.0-video";

function submitResponse(taskId = "task-1") {
  return transportResponse(200, {
    output: { task_id: taskId, task_status: "PENDING" },
    request_id: "submit-req",
  });
}

function taskResponse(status: string, extra: Record<string, unknown> = {}) {
  return transportResponse(200, {
    output: { task_id: "task-1", task_status: status, ...extra },
    usage: { duration: 5, video_count: 1, SR: 720, ratio: "16:9" },
    request_id: `poll-${status}`,
  });
}

const WAIT_OPTS = { pollIntervalMs: 0, timeoutMs: 5000 };

describe("aliyun-bailian Wan 3.0 video adapter", () => {
  test("video() binds wan3.0-video with video + async capabilities", () => {
    const { transport } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    const model = provider.video(WAN3);
    expect(model.modelId).toBe(WAN3);
    expect(model.providerId).toBe("aliyun-bailian");
    expect(model.capabilities.modality).toBe("video");
    expect(model.capabilities.async).toBe(true);
  });

  test("video() rejects an unknown model with UNKNOWN_MODEL", () => {
    const { transport } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

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
  });

  test("image() rejects wan3.0-video with INVALID_REQUEST", () => {
    const { transport } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    expect(() => provider.image(WAN3)).toThrow(/not an image model/);
  });

  test("builds text-to-video submit request with prompt only", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const task = await submitVideoTask({
      model,
      prompt: "一只猫在奔跑",
      providerOptions: {
        aliyun: { resolution: "720P", ratio: "16:9", duration: 5 },
      },
    });
    await task.wait(WAIT_OPTS);

    const request = requests[0]!;
    expect(request.method).toBe("POST");
    expect(request.url).toBe(
      "https://ws-id.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis"
    );
    const headers = request.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-key");
    expect(headers["X-DashScope-Async"]).toBe("enable");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = request.body as Record<string, unknown>;
    expect(body.model).toBe(WAN3);
    const input = body.input as Record<string, unknown>;
    expect(input.prompt).toBe("一只猫在奔跑");
    expect(input.media).toBeUndefined();
    const parameters = body.parameters as Record<string, unknown>;
    expect(parameters.resolution).toBe("720P");
    expect(parameters.ratio).toBe("16:9");
    expect(parameters.duration).toBe(5);
  });

  test("builds media-only request without prompt", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const task = await submitVideoTask({
      model,
      media: [
        { type: "reference_image", url: "https://x/a.png" },
        { type: "reference_video", url: "https://x/b.mp4" },
      ],
    });
    await task.wait(WAIT_OPTS);

    const body = requests[0]!.body as Record<string, unknown>;
    const input = body.input as Record<string, unknown>;
    expect(input.prompt).toBeUndefined();
    const media = input.media as Array<Record<string, unknown>>;
    expect(media).toHaveLength(2);
    expect(media[0]).toEqual({
      type: "reference_image",
      url: "https://x/a.png",
    });
    expect(media[1]).toEqual({
      type: "reference_video",
      url: "https://x/b.mp4",
    });
  });

  test("builds first/last frame request", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const task = await submitVideoTask({
      model,
      prompt: "画面渐变",
      media: [
        { type: "first_frame", url: "https://x/first.png" },
        { type: "last_frame", url: "https://x/last.png" },
      ],
    });
    await task.wait(WAIT_OPTS);

    const media = (requests[0]!.body as Record<string, unknown>)
      .input as Record<string, unknown>;
    const entries = media.media as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      type: "first_frame",
      url: "https://x/first.png",
    });
    expect(entries[1]).toEqual({
      type: "last_frame",
      url: "https://x/last.png",
    });
  });

  test("maps base64 image media to a data URI", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const task = await submitVideoTask({
      model,
      prompt: "动起来",
      media: [
        {
          type: "first_frame",
          base64: "aGVsbG8=",
          mimeType: "image/png",
        },
      ],
    });
    await task.wait(WAIT_OPTS);

    const media = (requests[0]!.body as Record<string, unknown>)
      .input as Record<string, unknown>;
    const entries = media.media as Array<Record<string, unknown>>;
    expect(entries[0]!.url).toBe("data:image/png;base64,aGVsbG8=");
  });

  test("preserves mixed reference media order", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const task = await submitVideoTask({
      model,
      prompt: "图1抱着图2",
      media: [
        { type: "reference_image", url: "https://x/girl.jpg" },
        { type: "reference_image", url: "https://x/guitar.png" },
        { type: "reference_video", url: "https://x/scene.mp4" },
        { type: "reference_audio", url: "https://x/song.mp3" },
        { type: "file", url: "https://x/doc.pptx" },
      ],
    });
    await task.wait(WAIT_OPTS);

    const media = (requests[0]!.body as Record<string, unknown>)
      .input as Record<string, unknown>;
    const entries = media.media as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(5);
    expect(entries[0]!.type).toBe("reference_image");
    expect(entries[1]!.type).toBe("reference_image");
    expect(entries[2]!.type).toBe("reference_video");
    expect(entries[3]!.type).toBe("reference_audio");
    expect(entries[4]!.type).toBe("file");
  });

  test("includes OSS resolve header for oss:// URLs", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const task = await submitVideoTask({
      model,
      prompt: "p",
      media: [
        { type: "reference_image", url: "oss://dashscope-instant/x/r.png" },
      ],
    });
    await task.wait(WAIT_OPTS);

    const headers = requests[0]!.headers as Record<string, string>;
    expect(headers["X-DashScope-OssResourceResolve"]).toBe("enable");
  });

  test("forwards audio boolean parameter", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const task = await submitVideoTask({
      model,
      prompt: "p",
      providerOptions: { aliyun: { audio: false } },
    });
    await task.wait(WAIT_OPTS);

    const parameters = (requests[0]!.body as Record<string, unknown>)
      .parameters as Record<string, unknown>;
    expect(parameters.audio).toBe(false);
    expect(parameters.audio_setting).toBeUndefined();
  });

  test("polls PENDING -> RUNNING -> SUCCEEDED and resolves with video url", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("PENDING"),
      taskResponse("RUNNING"),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const task = await submitVideoTask({ model, prompt: "p" });
    const result = await task.wait(WAIT_OPTS);

    expect(result.provider).toBe("aliyun-bailian");
    expect(result.model).toBe(WAN3);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.url).toBe("https://x/v.mp4");
    expect(result.content[0]?.duration).toBe(5);
    expect(requests).toHaveLength(4);
    expect(requests[1]!.method).toBe("GET");
    expect(requests[1]!.url).toBe(
      "https://ws-id.cn-beijing.maas.aliyuncs.com/api/v1/tasks/task-1"
    );
  });

  test("rejects when the task ends FAILED without leaking the key", async () => {
    const { transport } = createFakeTransport([
      submitResponse(),
      taskResponse("FAILED", { code: "InvalidParameter", message: "bad" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const task = await submitVideoTask({ model, prompt: "p" });
    const error = (await task
      .wait(WAIT_OPTS)
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.message).not.toContain("test-key");
  });

  test("classifies submit 401 as AUTH_ERROR without leaking the key", async () => {
    const { transport } = createFakeTransport([
      transportResponse(401, {
        code: "InvalidApiKey",
        message: "Invalid API-key provided.",
      }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const error = (await submitVideoTask({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("AUTH_ERROR");
    expect(error.retryable).toBe(false);
    expect(error.message).not.toContain("test-key");
  });

  test("classifies submit 429 as retryable RATE_LIMITED", async () => {
    const { transport } = createFakeTransport([
      transportResponse(429, { code: "Throttling", message: "slow down" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const error = (await submitVideoTask({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryable).toBe(true);
  });

  test("maps a transport timeout to TIMEOUT", async () => {
    const { transport } = createFakeTransport([transportTimeout()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const error = (await submitVideoTask({ model, prompt: "p" }).catch(
      (e: unknown) => e
    )) as SdkError;

    expect(error.code).toBe("TIMEOUT");
  });

  test("rejects when submit response has no task_id", async () => {
    const { transport } = createFakeTransport([
      transportResponse(200, { output: {}, request_id: "r" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    await expect(
      submitVideoTask({ model, prompt: "p" })
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });

  test("rejects when SUCCEEDED has no video_url", async () => {
    const { transport } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", {}),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const task = await submitVideoTask({ model, prompt: "p" });
    const error = (await task
      .wait(WAIT_OPTS)
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
  });
});

describe("aliyun-bailian Wan 3.0 validation", () => {
  test("rejects empty prompt and empty media before transport", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    await expect(
      submitVideoTask({ model } as VideoGenerationRequest)
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects frame and reference media together", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        media: [
          { type: "first_frame", url: "https://x/f.png" },
          { type: "reference_image", url: "https://x/r.png" },
        ],
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects file and link together", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        media: [
          { type: "file", url: "https://x/doc.pdf" },
          { type: "link", url: "https://x/article" },
        ],
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects 11 reference_image entries", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const refs: Wan3VideoMediaEntry[] = Array.from({ length: 11 }, () => ({
      type: "reference_image" as const,
      url: "https://x/r.png",
    }));
    await expect(
      submitVideoTask({ model, prompt: "p", media: refs })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects 6 reference_video entries", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const refs: Wan3VideoMediaEntry[] = Array.from({ length: 6 }, () => ({
      type: "reference_video" as const,
      url: "https://x/v.mp4",
    }));
    await expect(
      submitVideoTask({ model, prompt: "p", media: refs })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects 6 reference_audio entries", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const refs: Wan3VideoMediaEntry[] = Array.from({ length: 6 }, () => ({
      type: "reference_audio" as const,
      url: "https://x/a.mp3",
    }));
    await expect(
      submitVideoTask({ model, prompt: "p", media: refs })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects base64 for video media", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        media: [
          {
            type: "reference_video",
            url: "https://x/v.mp4",
            base64: "aGk=",
          } as Wan3VideoMediaEntry,
        ],
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects invalid duration below 2", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        providerOptions: { aliyun: { duration: 1 } },
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects invalid duration above 30", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        providerOptions: { aliyun: { duration: 31 } },
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects non-integer duration", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        providerOptions: { aliyun: { duration: 5.5 } },
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("accepts duration -1 for smart duration", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    const task = await submitVideoTask({
      model,
      prompt: "p",
      providerOptions: { aliyun: { duration: -1 } },
    });
    await task.wait(WAIT_OPTS);

    const parameters = (requests[0]!.body as Record<string, unknown>)
      .parameters as Record<string, unknown>;
    expect(parameters.duration).toBe(-1);
  });

  test("rejects invalid seed", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        providerOptions: { aliyun: { seed: -1 } },
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects seed above 2147483647", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        providerOptions: { aliyun: { seed: 2147483648 } },
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects invalid resolution", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        providerOptions: { aliyun: { resolution: "240P" } },
      } as VideoGenerationRequest)
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("rejects invalid ratio", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(WAN3);

    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        providerOptions: { aliyun: { ratio: "21:9" } },
      } as VideoGenerationRequest)
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });
});
