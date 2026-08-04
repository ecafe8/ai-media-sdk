import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";
import { submitVideoTask } from "@ai-media/sdk";

import { readAliyunVideoConfig, readAliyunVideoModel } from "./config";
import { saveResult } from "./save";

const prompt =
  process.argv.slice(2).join(" ") || "一座由硬纸板搭建的微型城市在夜晚焕发生机";
const startedAt = Date.now();

try {
  const provider = createAliyunBailianProvider(readAliyunVideoConfig());
  const task = await submitVideoTask({
    model: provider.video(readAliyunVideoModel()),
    prompt,
    providerOptions: {
      aliyun: {
        resolution: "720P",
        ratio: "16:9",
        duration: 5,
        watermark: false,
      },
    },
  });

  const result = await task.wait({
    pollIntervalMs: 15_000,
    timeoutMs: 600_000,
  });
  const outputDir = await saveResult(result.content, {
    provider: result.provider,
    model: result.model,
    requestId: result.requestId,
    prompt,
    startedAt,
  });
  console.log(
    JSON.stringify(
      {
        provider: result.provider,
        model: result.model,
        requestId: result.requestId,
        videos: result.content,
      },
      null,
      2
    )
  );
  console.log(`Saved result files to ${outputDir}`);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Video generation failed"
  );
  process.exitCode = 1;
}
