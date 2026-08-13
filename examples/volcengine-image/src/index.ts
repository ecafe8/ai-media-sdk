import { createVolcengineProvider } from "@ai-media/provider-volcengine";
import { generateImage } from "@ai-media/sdk";

import { readVolcengineConfig, readVolcengineModels } from "./config.js";
import { saveBatchSummary, saveResult } from "./save.js";

const prompt = process.argv.slice(2).join(" ") || "江南小镇的清晨，水彩画风格";
const batchStartedAt = Date.now();
const results: Array<Record<string, unknown>> = [];

try {
  const provider = createVolcengineProvider(readVolcengineConfig());
  const models = readVolcengineModels();
  console.log(`Starting batch: ${models.length} model(s)`);
  for (const modelId of models) {
    const startedAt = Date.now();
    console.log(`[${modelId}] starting; submitting sync request`);
    try {
      const result = await generateImage({
        model: provider.image(modelId),
        prompt,
        size: "2K",
        providerOptions: {
          volcengine: {
            watermark: false,
            output_format: "png",
            response_format: "url",
          },
        },
      });
      console.log(`[${modelId}] generation succeeded; saved result(s)`);
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
  console.log(JSON.stringify({ prompt, results }, null, 2));
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
