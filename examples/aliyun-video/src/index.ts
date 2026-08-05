import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";
import { submitVideoTask } from "@ai-media/sdk";

import {
  readAliyunVideoConfig,
  readAliyunVideoExampleInputs,
  readAliyunVideoModels,
} from "./config.js";
import { saveBatchSummary, saveResult } from "./save.js";

const prompt =
  process.argv.slice(2).join(" ") || "左侧背景不变,图片右侧的每个视频框内分别动态循环播放各自屏幕中的视频内容，视频框本身不动";
const models = readAliyunVideoModels();
const exampleInputs = readAliyunVideoExampleInputs();
const batchStartedAt = Date.now();
const results: Array<Record<string, unknown>> = [];

try {
  const provider = createAliyunBailianProvider(readAliyunVideoConfig());
  console.log(`Starting batch: ${models.length} model(s)`);
  for (const modelId of models) {
    const startedAt = Date.now();
    console.log(`[${modelId}] starting; submitting async task`);
    try {
      const isVideoEdit = modelId.includes("video-edit");
      const isR2v = modelId.includes("r2v");
      const isI2v = modelId.includes("i2v");
      const task = await submitVideoTask({
        model: provider.video(modelId),
        prompt,
        ...(isI2v && exampleInputs.firstFrameUrl
          ? { firstFrame: { url: exampleInputs.firstFrameUrl } }
          : {}),
        ...(isVideoEdit && exampleInputs.inputVideoUrl
          ? { inputVideo: { url: exampleInputs.inputVideoUrl } }
          : {}),
        ...(isR2v && exampleInputs.referenceImageUrls.length > 0
          ? {
              referenceImages: exampleInputs.referenceImageUrls.map(
                (url) => ({ url })
              ),
            }
          : {}),
        providerOptions: {
          aliyun: {
            resolution: "720P",
            ...(isR2v ? { ratio: "16:9" } : {}),
            ...(isVideoEdit ? {} : { duration: 15 }),
            watermark: false,
          },
        },
      });
      console.log(`[${modelId}] task submitted; polling provider`);
      const result = await task.wait({
        pollIntervalMs: 15_000,
        timeoutMs: 600_000,
      });
      console.log(`[${modelId}] generation succeeded; saving result(s)`);
      const outputDir = await saveResult(result.content, {
        provider: result.provider,
        model: result.model,
        requestId: result.requestId,
        prompt,
        startedAt,
        runId: new Date(startedAt)
          .toISOString()
          .slice(11, 23)
          .replace(/[:.]/g, ""),
      });
      results.push({ model: modelId, status: "succeeded", outputDir });
      console.log(
        JSON.stringify(
          { model: modelId, videos: result.content, outputDir },
          null,
          2
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Video generation failed";
      results.push({ model: modelId, status: "failed", error: message });
      console.error(`[${modelId}] failed: ${message}`);
    }
  }
  console.log(JSON.stringify({ prompt, results }, null, 2));
  console.log(
    `Saved batch summary to ${await saveBatchSummary(results, prompt, batchStartedAt)}`
  );
  if (results.every((result) => result.status === "failed"))
    process.exitCode = 1;
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Video generation failed"
  );
  process.exitCode = 1;
}
