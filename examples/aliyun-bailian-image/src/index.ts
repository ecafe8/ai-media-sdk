import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";
import { generateImage } from "@ai-media/sdk";

import { readAliyunConfig, readAliyunModel } from "./config";

const prompt = process.argv.slice(2).join(" ") || "江南小镇的清晨，水彩画风格";

try {
  const provider = createAliyunBailianProvider(readAliyunConfig());
  const result = await generateImage({
    model: provider.image(readAliyunModel()),
    prompt,
    n: 1,
    size: "1024*1024",
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
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Image generation failed"
  );
  process.exitCode = 1;
}
