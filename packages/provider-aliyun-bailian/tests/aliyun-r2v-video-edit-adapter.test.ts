/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import { SdkError, submitVideoTask, type VideoGenerationRequest } from "@ai-media/sdk";
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

const R2V = "happyhorse-1.1-r2v";
const VIDEO_EDIT = "happyhorse-1.0-video-edit";

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

describe("aliyun-bailian r2v/video-edit adapter", () => {
  test("video() binds r2v and video-edit models with video + async capabilities", () => {
    const { transport } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    const r2v = provider.video(R2V);
    expect(r2v.modelId).toBe(R2V);
    expect(r2v.capabilities.modality).toBe("video");
    expect(r2v.capabilities.async).toBe(true);

    const edit = provider.video(VIDEO_EDIT);
    expect(edit.modelId).toBe(VIDEO_EDIT);
    expect(edit.capabilities.async).toBe(true);
  });

  test("builds the r2v submit request with ordered reference_image media", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(R2V);

    const task = await submitVideoTask({
      model,
      prompt: "[Image 1] 中的角色",
      referenceImages: [
        { url: "https://x/a.png" },
        { url: "https://x/b.png" },
        { url: "https://x/c.png" },
      ],
      providerOptions: {
        aliyun: { resolution: "720P", ratio: "16:9", duration: 5 },
      },
    });
    await task.wait(WAIT_OPTS);

    const body = requests[0]!.body as Record<string, unknown>;
    const input = body.input as Record<string, unknown>;
    expect(input.prompt).toBe("[Image 1] 中的角色");
    const media = input.media as Array<Record<string, unknown>>;
    expect(media).toHaveLength(3);
    expect(media[0]).toEqual({
      type: "reference_image",
      url: "https://x/a.png",
    });
    expect(media[1]).toEqual({
      type: "reference_image",
      url: "https://x/b.png",
    });
    expect(media[2]).toEqual({
      type: "reference_image",
      url: "https://x/c.png",
    });
    const parameters = body.parameters as Record<string, unknown>;
    expect(parameters.resolution).toBe("720P");
    expect(parameters.ratio).toBe("16:9");
    expect(parameters.duration).toBe(5);
  });

  test("maps r2v base64 reference images to data URIs", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(R2V);

    const task = await submitVideoTask({
      model,
      prompt: "p",
      referenceImages: [{ base64: "aGk=", mimeType: "image/png" }],
    });
    await task.wait(WAIT_OPTS);

    const media = (requests[0]!.body as Record<string, unknown>)
      .input as Record<string, unknown>;
    const entries = media.media as Array<Record<string, unknown>>;
    expect(entries[0]!.url).toBe("data:image/png;base64,aGk=");
  });

  test("builds the video-edit request with source video first and optional references", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(VIDEO_EDIT);

    const task = await submitVideoTask({
      model,
      prompt: "换风格",
      inputVideo: { url: "https://x/source.mp4" },
      referenceImages: [
        { url: "https://x/ref1.png" },
        { url: "https://x/ref2.png" },
      ],
      providerOptions: {
        aliyun: {
          resolution: "1080P",
          audio_setting: "origin",
          watermark: false,
        },
      },
    });
    await task.wait(WAIT_OPTS);

    const body = requests[0]!.body as Record<string, unknown>;
    const input = body.input as Record<string, unknown>;
    expect(input.prompt).toBe("换风格");
    const media = input.media as Array<Record<string, unknown>>;
    expect(media).toHaveLength(3);
    expect(media[0]).toEqual({ type: "video", url: "https://x/source.mp4" });
    expect(media[1]).toEqual({
      type: "reference_image",
      url: "https://x/ref1.png",
    });
    expect(media[2]).toEqual({
      type: "reference_image",
      url: "https://x/ref2.png",
    });
    const parameters = body.parameters as Record<string, unknown>;
    expect(parameters.resolution).toBe("1080P");
    expect(parameters.audio_setting).toBe("origin");
    expect(parameters.watermark).toBe(false);
    expect(parameters.ratio).toBeUndefined();
    expect(parameters.duration).toBeUndefined();
  });

  test("video-edit accepts zero reference images", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(VIDEO_EDIT);

    const task = await submitVideoTask({
      model,
      prompt: "p",
      inputVideo: { url: "https://x/source.mp4" },
    });
    await task.wait(WAIT_OPTS);

    const media = (requests[0]!.body as Record<string, unknown>)
      .input as Record<string, unknown>;
    const entries = media.media as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(1);
    expect(entries[0]!.type).toBe("video");
  });

  test("r2v rejects missing reference images before transport", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(R2V);

    // Cast to the untyped VideoGenerationRequest: the family TParams would
    // otherwise narrow `referenceImages` to required at compile time. The
    // test deliberately passes a missing value to exercise the runtime
    // adapter validator path.
    await expect(
      submitVideoTask({ model, prompt: "p" } as VideoGenerationRequest)
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("r2v rejects more than 9 reference images before transport", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(R2V);

    const refs = Array.from({ length: 10 }, (_, i) => ({
      url: `https://x/${i}.png`,
    }));
    await expect(
      submitVideoTask({ model, prompt: "p", referenceImages: refs })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("video-edit rejects a missing input video before transport", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(VIDEO_EDIT);

    // Cast to the untyped VideoGenerationRequest: the family TParams would
    // otherwise narrow `inputVideo` to required at compile time. The test
    // deliberately passes a missing value to exercise the runtime adapter
    // validator path.
    await expect(
      submitVideoTask({ model, prompt: "p" } as VideoGenerationRequest)
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("video-edit rejects a non-HTTP input video URL before transport", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(VIDEO_EDIT);

    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        inputVideo: { url: "ftp://x/source.mp4" },
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("video-edit rejects more than 5 reference images before transport", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(VIDEO_EDIT);

    const refs = Array.from({ length: 6 }, (_, i) => ({
      url: `https://x/${i}.png`,
    }));
    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        inputVideo: { url: "https://x/source.mp4" },
        referenceImages: refs,
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("t2v rejects media inputs before transport", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video("happyhorse-1.1-t2v");

    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        referenceImages: [{ url: "https://x/a.png" }],
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("r2v rejects an empty prompt before transport", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(R2V);

    await expect(
      submitVideoTask({
        model,
        prompt: "",
        referenceImages: [{ url: "https://x/a.png" }],
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("video-edit rejects an empty prompt before transport", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(VIDEO_EDIT);

    await expect(
      submitVideoTask({
        model,
        prompt: "",
        inputVideo: { url: "https://x/source.mp4" },
      })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("video-edit rejects an invalid audio_setting before transport", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(VIDEO_EDIT);

    // `audio_setting: "loud"` is deliberately outside the family-typed
    // `"auto" | "origin"` union; cast to the untyped request shape so the
    // runtime adapter validator path is exercised.
    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        inputVideo: { url: "https://x/source.mp4" },
        providerOptions: { aliyun: { audio_setting: "loud" } },
      } as VideoGenerationRequest)
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("video-edit rejects an invalid resolution before transport", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(VIDEO_EDIT);

    // `resolution: "480P"` is deliberately outside the video-edit family's
    // `"720P" | "1080P"` union; cast to the untyped request shape so the
    // runtime adapter validator path is exercised.
    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        inputVideo: { url: "https://x/source.mp4" },
        providerOptions: { aliyun: { resolution: "480P" } },
      } as VideoGenerationRequest)
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("polls PENDING -> RUNNING -> SUCCEEDED and resolves with the video url", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("PENDING"),
      taskResponse("RUNNING"),
      taskResponse("SUCCEEDED", { video_url: "https://x/v.mp4" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(R2V);

    const task = await submitVideoTask({
      model,
      prompt: "p",
      referenceImages: [{ url: "https://x/a.png" }],
    });
    const result = await task.wait(WAIT_OPTS);

    expect(result.provider).toBe("aliyun-bailian");
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.url).toBe("https://x/v.mp4");
    expect(result.content[0]?.duration).toBe(5);
    expect(requests).toHaveLength(4);
  });

  test("rejects when the task ends FAILED without leaking the key", async () => {
    const { transport } = createFakeTransport([
      submitResponse(),
      taskResponse("FAILED", { code: "InvalidParameter", message: "bad" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(VIDEO_EDIT);

    const task = await submitVideoTask({
      model,
      prompt: "p",
      inputVideo: { url: "https://x/source.mp4" },
    });
    const error = (await task
      .wait(WAIT_OPTS)
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.message).not.toContain("test-key");
  });

  test("rejects when submit response has no task_id", async () => {
    const { transport } = createFakeTransport([
      transportResponse(200, { output: {}, request_id: "r" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(R2V);

    await expect(
      submitVideoTask({
        model,
        prompt: "p",
        referenceImages: [{ url: "https://x/a.png" }],
      })
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });

  test("rejects when SUCCEEDED has no video_url", async () => {
    const { transport } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", {}),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(VIDEO_EDIT);

    const task = await submitVideoTask({
      model,
      prompt: "p",
      inputVideo: { url: "https://x/source.mp4" },
    });
    const error = (await task
      .wait(WAIT_OPTS)
      .catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
  });

  test("classifies submit 401 without leaking the key", async () => {
    const { transport } = createFakeTransport([
      transportResponse(401, {
        code: "InvalidApiKey",
        message: "Invalid API-key provided.",
      }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(R2V);

    const error = (await submitVideoTask({
      model,
      prompt: "p",
      referenceImages: [{ url: "https://x/a.png" }],
    }).catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("AUTH_ERROR");
    expect(error.message).not.toContain("test-key");
  });

  test("maps a transport timeout to TIMEOUT", async () => {
    const { transport } = createFakeTransport([transportTimeout()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const model = provider.video(VIDEO_EDIT);

    const error = (await submitVideoTask({
      model,
      prompt: "p",
      inputVideo: { url: "https://x/source.mp4" },
    }).catch((e: unknown) => e)) as SdkError;

    expect(error.code).toBe("TIMEOUT");
  });
});
