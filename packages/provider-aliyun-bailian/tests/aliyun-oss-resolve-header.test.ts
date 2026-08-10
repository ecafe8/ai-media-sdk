/// <reference types="bun" />

import { describe, expect, test } from "bun:test";
import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";
import { editImage } from "@ai-media/sdk";

import {
  createFakeTransport,
  transportResponse,
} from "./helpers/fake-transport.js";

const ALIYUN_CONFIG = {
  apiKey: "test-key",
  baseUrl: "https://ws-id.cn-beijing.maas.aliyuncs.com/api/v1",
};

const QWEN = "qwen-image-2.0-pro";

function qwenResponse(images: string[]) {
  return transportResponse(200, {
    output: {
      choices: [
        {
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: images.map((image) => ({ image })),
          },
        },
      ],
    },
    usage: { width: 1024, height: 1024, image_count: images.length },
    request_id: "req-1",
  });
}

describe("aliyun adapter X-DashScope-OssResourceResolve header", () => {
  test("injects header when image URL is oss://", async () => {
    const { transport, requests } = createFakeTransport([qwenResponse(["r"])]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    await editImage({
      model: provider.image(QWEN),
      prompt: "describe this",
      images: [{ url: "oss://dashscope-instant/xxx/cat.png" }],
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]!.headers!["X-DashScope-OssResourceResolve"]).toBe(
      "enable"
    );
  });

  test("does not inject header when image URL is https://", async () => {
    const { transport, requests } = createFakeTransport([qwenResponse(["r"])]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    await editImage({
      model: provider.image(QWEN),
      prompt: "describe this",
      images: [{ url: "https://example.com/cat.png" }],
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]!.headers!["X-DashScope-OssResourceResolve"]).toBe(
      undefined
    );
  });

  test("does not inject header when image is base64 data:", async () => {
    const { transport, requests } = createFakeTransport([qwenResponse(["r"])]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    await editImage({
      model: provider.image(QWEN),
      prompt: "describe this",
      images: [{ base64: "iVBORw0KGgo=", mimeType: "image/png" }],
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]!.headers!["X-DashScope-OssResourceResolve"]).toBe(
      undefined
    );
  });

  test("injects header when at least one of multiple images is oss://", async () => {
    const { transport, requests } = createFakeTransport([qwenResponse(["r"])]);
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    await editImage({
      model: provider.image(QWEN),
      prompt: "describe this",
      images: [
        { url: "https://example.com/a.png" },
        { url: "oss://dashscope-instant/xxx/b.png" },
      ],
    });

    expect(requests[0]!.headers!["X-DashScope-OssResourceResolve"]).toBe(
      "enable"
    );
  });
});
