import { createMiniMaxProvider } from "@ai-media/provider-minimax";
import { submitVideoTask } from "@ai-media/sdk";

import {
  readMiniMaxVideoConfig,
  readMiniMaxVideoExampleInputs,
  readMiniMaxVideoModels,
  readMiniMaxVideoOptions,
} from "./config.js";
import { saveBatchSummary, saveResult } from "./save.js";

const prompt =
  process.argv.slice(2).join(" ") || "A boy playing basketball by the sea";
const models = readMiniMaxVideoModels();
const exampleInputs = readMiniMaxVideoExampleInputs();
const exampleOptions = readMiniMaxVideoOptions();
const batchStartedAt = Date.now();
const results: Array<Record<string, unknown>> = [];

const hasReferences =
  exampleInputs.referenceImageUrls.length > 0 ||
  exampleInputs.referenceVideoUrls.length > 0 ||
  exampleInputs.referenceAudioUrls.length > 0;
const hasFrames = Boolean(exampleInputs.firstFrameUrl);
const scenario = hasReferences ? "r2v" : hasFrames ? "i2v" : "t2v";

try {
  const provider = createMiniMaxProvider(readMiniMaxVideoConfig());
  console.log(
    `Starting batch: ${models.length} model(s), scenario ${scenario}`
  );
  for (const modelId of models) {
    const startedAt = Date.now();
    console.log(`[${modelId}] starting; submitting async task`);
    try {
      const task = await submitVideoTask({
        model: provider.video(modelId),
        prompt,
        ...(hasReferences
          ? {
              ...(exampleInputs.referenceImageUrls.length > 0
                ? {
                    referenceImages: exampleInputs.referenceImageUrls.map(
                      (url) => ({ url })
                    ),
                  }
                : {}),
              ...(exampleInputs.referenceVideoUrls.length > 0
                ? {
                    referenceVideos: exampleInputs.referenceVideoUrls.map(
                      (url) => ({ url })
                    ),
                  }
                : {}),
              ...(exampleInputs.referenceAudioUrls.length > 0
                ? {
                    referenceAudios: exampleInputs.referenceAudioUrls.map(
                      (url) => ({ url })
                    ),
                  }
                : {}),
            }
          : {
              ...(exampleInputs.firstFrameUrl
                ? { firstFrame: { url: exampleInputs.firstFrameUrl } }
                : {}),
              ...(exampleInputs.lastFrameUrl
                ? { lastFrame: { url: exampleInputs.lastFrameUrl } }
                : {}),
            }),
        providerOptions: {
          minimax: {
            resolution: exampleOptions.resolution,
            duration: exampleOptions.duration,
            // Text-to-video requires a concrete ratio; image-to-video always
            // resolves to adaptive; reference-to-video defaults to adaptive.
            ...(scenario === "t2v"
              ? { ratio: exampleOptions.ratio ?? "16:9" }
              : exampleOptions.ratio
                ? { ratio: exampleOptions.ratio }
                : {}),
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
