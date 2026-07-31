import { createSeedreamProvider } from "@ai-media/provider-seedream";
import { generateImage } from "@ai-media/sdk";

import { readSeedreamConfig, readSeedreamModel } from "./config";

const prompt = process.argv.slice(2).join(" ") || "江南小镇的清晨，水彩画风格";

try {
  const provider = createSeedreamProvider(readSeedreamConfig());
  const result = await generateImage({
    model: provider.image(readSeedreamModel()),
    prompt,
    size: "2K",
    providerOptions: {
      seedream: {
        watermark: false,
        output_format: "png",
        response_format: "url",
      },
    },
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
