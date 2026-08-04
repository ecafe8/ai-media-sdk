import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";
import { generateImage, submitImageTask } from "@ai-media/sdk";

import { readAliyunConfig, readAliyunModel } from "./config";
import { saveResult } from "./save";

const prompt = process.argv.slice(2).join(" ") || "江南小镇的清晨，水彩画风格";
const startedAt = Date.now();

try {
  const provider = createAliyunBailianProvider(readAliyunConfig());
  const modelId = readAliyunModel();
  const model = provider.image(modelId);
  const result =
    modelId.startsWith("wan") || modelId === "z-image-turbo"
      ? await (
          await submitImageTask({
            model,
            prompt,
            n: 1,
            size: "1024*1024",
          })
        ).wait()
      : await generateImage({
          model,
          prompt,
          n: 1,
          size: "1024*1024",
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
        images: result.content,
      },
      null,
      2
    )
  );
  console.log(`Saved result files to ${outputDir}`);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Image generation failed"
  );
  process.exitCode = 1;
}
