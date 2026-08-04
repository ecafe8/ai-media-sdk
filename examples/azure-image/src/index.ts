import { createAzureOpenAIProvider } from "@ai-media/provider-azure-openai";
import { generateImage } from "@ai-media/sdk";

import { readAzureConfig, readAzureDeployments } from "./config.js";
import { saveBatchSummary, saveResult } from "./save.js";

const prompt =
  process.argv.slice(2).join(" ") || "A quiet riverside town at sunrise";
const batchStartedAt = Date.now();
const results: Array<Record<string, unknown>> = [];

try {
  const provider = createAzureOpenAIProvider(readAzureConfig());
  for (const deployment of readAzureDeployments()) {
    const startedAt = Date.now();
    try {
      const result = await generateImage({
        model: provider.image(deployment),
        prompt,
        n: 1,
        size: "1024x1024",
      });
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
      results.push({ model: deployment, status: "succeeded", outputDir });
      console.log(
        JSON.stringify(
          { model: deployment, images: result.content, outputDir },
          null,
          2
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image generation failed";
      results.push({ model: deployment, status: "failed", error: message });
      console.error(`[${deployment}] ${message}`);
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
