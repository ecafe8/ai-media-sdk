import { createAliyunBailianProvider } from "@ai-media/provider-aliyun-bailian";
import { editImage } from "@ai-media/sdk";
import { createAliyunUploader } from "@ai-media/uploader/aliyun";

import { readExampleConfig } from "./config.js";

/**
 * Upload-then-generate round-trip:
 * 1. Upload a local image to DashScope temporary storage, bound to the model.
 * 2. Use the returned `oss://` URL as the reference image for an I2I edit call.
 * 3. Print the generated image URL or a sanitized error.
 *
 * The Aliyun provider adapter auto-injects `X-DashScope-OssResourceResolve:
 * enable` when it detects the `oss://` URL, so no manual header management.
 *
 * Dev/test only: the Aliyun policy endpoint is rate-limited to 100 QPS per
 * account+model and temporary URLs expire after 48 hours. Use durable OSS for
 * production.
 */
async function main(): Promise<void> {
  const config = readExampleConfig();
  const uploader = createAliyunUploader({ apiKey: config.provider.apiKey });
  const provider = createAliyunBailianProvider(config.provider);
  const model = provider.image(config.model);

  console.log(`[uploader] uploading ${config.imagePath} for model ${config.model}`);
  const uploaded = await uploader.upload({
    model: config.model,
    filePath: config.imagePath,
  });
  console.log(
    `[uploader] uploaded; url=${uploaded.url} expiresAt=${uploaded.expiresAt.toISOString()}`
  );

  console.log(`[sdk] calling editImage with prompt: ${config.prompt}`);
  const result = await editImage({
    model,
    prompt: config.prompt,
    images: [{ url: uploaded.url }],
  });

  for (const [index, image] of result.content.entries()) {
    console.log(
      `[sdk] result ${index}: ${image.url ?? "(base64)"}${image.mimeType ? ` (${image.mimeType})` : ""}`
    );
  }
  console.log(
    JSON.stringify(
      {
        model: result.model,
        provider: result.provider,
        requestId: result.requestId,
        imageCount: result.content.length,
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Example failed");
  process.exitCode = 1;
});
