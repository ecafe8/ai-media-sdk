/// <reference types="bun" />

import { describe, expect, test } from "bun:test";
import { createMiniMaxProvider } from "@ai-media/provider-minimax";
import { submitVideoTask, type VideoGenerationRequest } from "@ai-media/sdk";

import {
  createFakeTransport,
  transportResponse,
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
  return transportResponse(200, { task: { id: "task-1", status, ...extra } });
}

const STEPS = [
  submitResponse(),
  taskResponse("succeeded", { content: { url: "https://x/v.mp4" } }),
];

const WAIT_OPTS = { pollIntervalMs: 0, timeoutMs: 5000 };

async function expectInvalidRequest(
  request: VideoGenerationRequest
): Promise<void> {
  await expect(submitVideoTask(request)).rejects.toMatchObject({
    code: "INVALID_REQUEST",
  });
}

describe("minimax video input validation", () => {
  test("rejects an empty prompt before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "   ",
      providerOptions: BASE_OPTIONS,
    } as VideoGenerationRequest);
    expect(requests).toHaveLength(0);
  });

  test("rejects missing providerOptions.minimax before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
    } as VideoGenerationRequest);
    expect(requests).toHaveLength(0);
  });

  test("rejects frames mixed with reference media before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      firstFrame: { url: "https://example.com/first.png" },
      referenceImages: [{ url: "https://example.com/ref.png" }],
      providerOptions: BASE_OPTIONS,
    } as VideoGenerationRequest);
    expect(requests).toHaveLength(0);
  });

  test("rejects a lastFrame without a firstFrame before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      lastFrame: { url: "https://example.com/last.png" },
      providerOptions: BASE_OPTIONS,
    } as VideoGenerationRequest);
    expect(requests).toHaveLength(0);
  });

  test("rejects reference counts above the limits before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const manyImages = Array.from({ length: 10 }, (_, i) => ({
      url: `https://example.com/${i}.png`,
    }));
    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      referenceImages: manyImages,
      providerOptions: BASE_OPTIONS,
    } as VideoGenerationRequest);

    const manyVideos = Array.from({ length: 4 }, (_, i) => ({
      url: `https://example.com/${i}.mp4`,
    }));
    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      referenceVideos: manyVideos,
      providerOptions: BASE_OPTIONS,
    } as VideoGenerationRequest);

    const manyAudios = Array.from({ length: 4 }, (_, i) => ({
      url: `https://example.com/${i}.mp3`,
    }));
    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      referenceAudios: manyAudios,
      providerOptions: BASE_OPTIONS,
    } as VideoGenerationRequest);

    expect(requests).toHaveLength(0);
  });

  test("rejects reference media without a url before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      referenceVideos: [{ url: "" }],
      providerOptions: BASE_OPTIONS,
    } as VideoGenerationRequest);

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      referenceAudios: [{ url: "" }],
      providerOptions: BASE_OPTIONS,
    } as VideoGenerationRequest);

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      referenceImages: [{}],
      providerOptions: BASE_OPTIONS,
    } as VideoGenerationRequest);

    expect(requests).toHaveLength(0);
  });

  test("rejects frames without url or base64 before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      firstFrame: {},
      providerOptions: BASE_OPTIONS,
    } as VideoGenerationRequest);
    expect(requests).toHaveLength(0);
  });

  test("rejects reference durations outside 2-15 seconds before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      referenceVideos: [{ url: "https://example.com/a.mp4", duration: 20 }],
      providerOptions: BASE_OPTIONS,
    } as VideoGenerationRequest);
    expect(requests).toHaveLength(0);
  });

  test("rejects reference durations totaling more than 15 seconds before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      referenceVideos: [
        { url: "https://example.com/a.mp4", duration: 8 },
        { url: "https://example.com/b.mp4", duration: 8 },
      ],
      providerOptions: BASE_OPTIONS,
    } as VideoGenerationRequest);
    expect(requests).toHaveLength(0);
  });

  test("skips duration validation when metadata is absent", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    const task = await submitVideoTask({
      model: provider.video(H3),
      prompt: "p",
      referenceVideos: [
        { url: "https://example.com/a.mp4" },
        { url: "https://example.com/b.mp4" },
      ],
      providerOptions: { minimax: { resolution: "2K", duration: 5 } },
    });
    await task.wait(WAIT_OPTS);
    expect(requests.length).toBeGreaterThan(0);
  });

  test("rejects text-to-video without a ratio before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: { minimax: { resolution: "2K", duration: 5 } },
    } as VideoGenerationRequest);
    expect(requests).toHaveLength(0);
  });

  test("rejects text-to-video with adaptive ratio before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: {
        minimax: { resolution: "2K", duration: 5, ratio: "adaptive" },
      },
    } as VideoGenerationRequest);
    expect(requests).toHaveLength(0);
  });

  test("rejects an out-of-set ratio before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      referenceImages: [{ url: "https://example.com/ref.png" }],
      providerOptions: {
        minimax: { resolution: "2K", duration: 5, ratio: "2:1" },
      },
    } as VideoGenerationRequest);
    expect(requests).toHaveLength(0);
  });

  test("rejects an unsupported resolution before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: {
        minimax: { resolution: "4K", duration: 5, ratio: "16:9" },
      },
    } as VideoGenerationRequest);
    expect(requests).toHaveLength(0);
  });

  test("rejects a duration outside 4-15 before transport", async () => {
    const { transport, requests } = createFakeTransport(STEPS);
    const provider = createMiniMaxProvider(MINIMAX_CONFIG, { transport });

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: {
        minimax: { resolution: "2K", duration: 3, ratio: "16:9" },
      },
    } as VideoGenerationRequest);

    await expectInvalidRequest({
      model: provider.video(H3),
      prompt: "p",
      providerOptions: {
        minimax: { resolution: "2K", duration: 16, ratio: "16:9" },
      },
    } as VideoGenerationRequest);
    expect(requests).toHaveLength(0);
  });
});
