import { describe, expect, test } from "bun:test";

import type {
  Transport,
  TransportRequest,
  TransportResponse,
} from "@ai-media/sdk";
import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";

function createCountingTransport(): {
  transport: Transport;
  getCount: () => number;
} {
  let count = 0;
  const transport: Transport = {
    async send<T>(_request: TransportRequest): Promise<TransportResponse<T>> {
      count += 1;
      return {
        status: 200,
        headers: {},
        data: {} as T,
      };
    },
  };
  return { transport, getCount: () => count };
}

const ALIYUN_CONFIG = {
  apiKey: "test-key",
  baseUrl: "https://dashscope.aliyuncs.com",
};

const ALIYUN_REQUEST = {
  provider: "aliyun-bailian",
  model: "wanx-v1",
  modality: "image" as const,
  input: {},
};

describe("aliyun-bailian provider phase 0", () => {
  test("factory retains the injected transport", () => {
    const { transport } = createCountingTransport();
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    expect(provider.transport).toBe(transport);
    expect(provider.providerId).toBe("aliyun-bailian");
  });

  test("adapter stubs reject without invoking the transport", async () => {
    const { transport, getCount } = createCountingTransport();
    const provider = createAliyunBailianProvider(ALIYUN_CONFIG, { transport });

    await expect(provider.generate(ALIYUN_REQUEST)).rejects.toThrow();
    await expect(provider.edit(ALIYUN_REQUEST)).rejects.toThrow();

    expect(getCount()).toBe(0);
  });
});
