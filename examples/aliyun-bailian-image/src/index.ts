import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";
import { generateImage, submitImageTask } from "@ai-media/sdk";

import { readAliyunConfig, readAliyunModels } from "./config.js";
import { saveBatchSummary, saveResult } from "./save.js";

const prompt = process.argv.slice(2).join(" ") || "江南小镇的清晨，水彩画风格";
const batchStartedAt = Date.now();
const results: Array<Record<string, unknown>> = [];

try {
  const provider = createAliyunBailianProvider(readAliyunConfig());
  console.log("Available models:");
  for (const model of provider.listModels()) {
    const caps = model.capabilities;
    const async = caps.async ? " async" : "";
    console.log(
      `  - ${model.id} [${model.modality}] generate=${caps.generate} edit=${caps.edit}${async}`
    );
  }
  const models = readAliyunModels();
  console.log(`Starting batch: ${models.length} model(s)`);
  for (const modelId of models) {
    const startedAt = Date.now();
    console.log(`[${modelId}] starting`);
    try {
      const model = provider.image(modelId);
      console.log(`[${modelId}] submitting request`);
      const result = modelId.startsWith("wan")
        ? await (
            await submitImageTask({
              model,
              prompt,
              n: 1,
              size: "1024*1024",
            })
          ).wait()
        : await generateImage({ model, prompt, n: 1, size: "1024*1024" });
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
      console.log(`[${modelId}] generation succeeded; saved to ${outputDir}`);
      results.push({ model: modelId, status: "succeeded", outputDir });
      console.log(
        JSON.stringify(
          { model: modelId, images: result.content, outputDir },
          null,
          2
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image generation failed";
      results.push({ model: modelId, status: "failed", error: message });
      console.error(`[${modelId}] failed: ${message}`);
    }
  }
  console.log(
    JSON.stringify(
      { prompt, durationMs: Date.now() - batchStartedAt, results },
      null,
      2
    )
  );
  console.log(
    `Saved batch summary to ${await saveBatchSummary(results, prompt, batchStartedAt)}`
  );
  if (results.every((result) => result.status === "failed"))
    process.exitCode = 1;
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Image generation failed"
  );
  process.exitCode = 1;
}
