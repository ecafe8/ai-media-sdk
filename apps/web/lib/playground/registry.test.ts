import { describe, expect, test } from "bun:test";

import { getClientPlaygroundModels, getPlaygroundModel } from "./registry";

describe("Playground capability registry", () => {
  test("marks only configured Providers as available", () => {
    const models = getClientPlaygroundModels(new Set(["aliyun-bailian"]));
    expect(
      models.find((model) => model.id === "qwen-image-2.0-pro")?.configured
    ).toBe(true);
    expect(models.find((model) => model.id === "gpt-image-2")?.configured).toBe(
      false
    );
  });

  test("keeps z-image-turbo generation-only", () => {
    const model = getPlaygroundModel("aliyun-bailian", "z-image-turbo");
    expect(model?.supportsGenerate).toBe(true);
    expect(model?.supportsEdit).toBe(false);
  });
});
