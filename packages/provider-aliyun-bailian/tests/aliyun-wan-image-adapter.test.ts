/// <reference types="bun" />

import { describe, expect, test } from "bun:test";

import { SdkError, submitImageTask } from "@ai-media/sdk";
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
const WAN_PRO = "wan2.7-image-pro";
const Z_IMAGE = "z-image-turbo";
const WAIT_OPTS = { pollIntervalMs: 0, timeoutMs: 5000 };

function submitResponse(taskId = "task-1") {
  return transportResponse(200, {
    output: { task_id: taskId, task_status: "PENDING" },
    request_id: "submit-req",
  });
}

function taskResponse(status: string, extra: Record<string, unknown> = {}) {
  return transportResponse(200, {
    output: { task_id: "task-1", task_status: status, ...extra },
    usage: { image_count: 2, width: 1024, height: 1024 },
    request_id: `poll-${status}`,
  });
}

describe("aliyun-bailian Wan image async adapter", () => {
  test("binds Wan models with image + async capabilities", () => {
    const { transport } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    const model = provider.image(WAN_PRO);

    expect(model.providerId).toBe("aliyun-bailian");
    expect(model.capabilities.modality).toBe("image");
    expect(model.capabilities.async).toBe(true);
  });

  test("builds the Wan async submit request and excludes Qwen-only fields", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { results: [{ url: "https://x/1.png" }] }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    const task = await submitImageTask({
      model: provider.image(WAN_PRO),
      prompt: "一只猫",
      n: 2,
      size: "1024x1024",
      providerOptions: {
        aliyun: {
          watermark: false,
          seed: 7,
          negative_prompt: "不要文字",
          prompt_extend: true,
        },
      },
    });
    await task.wait(WAIT_OPTS);

    const request = requests[0]!;
    expect(request.method).toBe("POST");
    expect(request.url).toBe(
      "https://ws-id.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/image-generation/generation"
    );
    const headers = request.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["X-DashScope-Async"]).toBe("enable");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = request.body as Record<string, unknown>;
    expect(body.model).toBe(WAN_PRO);
    const input = body.input as Record<string, unknown>;
    expect(input.messages).toEqual([
      { role: "user", content: [{ text: "一只猫" }] },
    ]);
    expect(input.media).toBeUndefined();
    const parameters = body.parameters as Record<string, unknown>;
    expect(parameters.size).toBe("1024*1024");
    expect(parameters.n).toBe(2);
    expect(parameters.watermark).toBe(false);
    expect(parameters.seed).toBe(7);
    expect(parameters.negative_prompt).toBeUndefined();
    expect(parameters.prompt_extend).toBeUndefined();
  });

  test("rejects z-image-turbo async submission before transport", async () => {
    const { transport, requests } = createFakeTransport([submitResponse()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    await expect(
      submitImageTask({ model: provider.image(Z_IMAGE), prompt: "一只猫" })
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(requests).toHaveLength(0);
  });

  test("polls PENDING -> PROCESSING -> SUCCEEDED and maps multiple image urls", async () => {
    const { transport, requests } = createFakeTransport([
      submitResponse(),
      taskResponse("PENDING"),
      taskResponse("PROCESSING"),
      taskResponse("SUCCEEDED", {
        results: [{ url: "https://x/1.png" }, { url: "https://x/2.png" }],
      }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    const task = await submitImageTask({
      model: provider.image(WAN_PRO),
      prompt: "p",
      n: 2,
    });
    const result = await task.wait(WAIT_OPTS);

    expect(result.provider).toBe("aliyun-bailian");
    expect(result.model).toBe(WAN_PRO);
    expect(result.requestId).toBe("poll-SUCCEEDED");
    expect(result.content.map((image) => image.url)).toEqual([
      "https://x/1.png",
      "https://x/2.png",
    ]);
    expect(requests).toHaveLength(4);
    expect(requests[1]!.method).toBe("GET");
    expect(requests[1]!.url).toBe(
      "https://ws-id.cn-beijing.maas.aliyuncs.com/api/v1/tasks/task-1"
    );
  });

  test("rejects a succeeded task with no image urls", async () => {
    const { transport } = createFakeTransport([
      submitResponse(),
      taskResponse("SUCCEEDED", { results: [] }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    const task = await submitImageTask({
      model: provider.image(WAN_PRO),
      prompt: "p",
    });
    const error = (await task
      .wait(WAIT_OPTS)
      .catch((value: unknown) => value)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
  });

  test("rejects when the task ends FAILED without leaking the key", async () => {
    const { transport } = createFakeTransport([
      submitResponse(),
      taskResponse("FAILED", { code: "InvalidParameter", message: "bad" }),
    ]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    const task = await submitImageTask({
      model: provider.image(WAN_PRO),
      prompt: "p",
    });
    const error = (await task
      .wait(WAIT_OPTS)
      .catch((value: unknown) => value)) as SdkError;

    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.message).not.toContain("test-key");
  });

  test("classifies submit failures and timeout", async () => {
    const cases = [
      [401, { code: "InvalidApiKey", message: "invalid" }, "AUTH_ERROR"],
      [429, { code: "Throttling", message: "slow" }, "RATE_LIMITED"],
      [400, { code: "InvalidParameter", message: "bad" }, "INVALID_REQUEST"],
      [503, { code: "InternalError", message: "down" }, "PROVIDER_ERROR"],
    ] as const;

    for (const [status, data, code] of cases) {
      const { transport } = createFakeTransport([
        transportResponse(status, data),
      ]);
      const provider = createAliyunBailianProvider(ALIYUN_CONFIG, {
        transport,
      });
      const error = (await submitImageTask({
        model: provider.image(WAN_PRO),
        prompt: "p",
      }).catch((value: unknown) => value)) as SdkError;

      expect(error.code).toBe(code);
      expect(error.message).not.toContain("test-key");
    }

    const { transport } = createFakeTransport([transportTimeout()]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });
    const error = (await submitImageTask({
      model: provider.image(WAN_PRO),
      prompt: "p",
    }).catch((value: unknown) => value)) as SdkError;
    expect(error.code).toBe("TIMEOUT");
  });
});
