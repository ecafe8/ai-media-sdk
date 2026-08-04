import { createAzureOpenAIProvider } from "@ai-media/provider-azure-openai";
import { generateImage } from "@ai-media/sdk";

import { readAzureConfig, readAzureDeployment } from "./config";
import { saveResult } from "./save";

const prompt =
  process.argv.slice(2).join(" ") || "A quiet riverside town at sunrise";
const startedAt = Date.now();

try {
  const provider = createAzureOpenAIProvider(readAzureConfig());
  const result = await generateImage({
    model: provider.image(readAzureDeployment()),
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
