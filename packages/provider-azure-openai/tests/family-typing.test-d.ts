/**
 * Compile-time type tests for Azure OpenAI family-level `image()` overloads.
 *
 * These are not executed by `bun test`; they are validated by `tsc -p
 * tsconfig.test.json`. Each `// @ts-expect-error` directive asserts that
 * TypeScript rejects an out-of-family value at compile time. If the
 * narrowing regresses, the directive stops firing and `tsc` errors out
 * ("Unused '@ts-expect-error' directive").
 */

import {
  generateImage,
  submitImageTask,
  type ImageGenerationInput,
} from "@ai-media/sdk";
import {
  createAzureOpenAIProvider,
  type AzureGptImage2Params,
} from "@ai-media/provider-azure-openai";

declare const config: {
  apiKey: string;
  endpoint: string;
  apiVersion: string;
};

const azure = createAzureOpenAIProvider(config);

// Literal overload returns the family-typed model.
const gptImage2Model = azure.image("gpt-image-2");
type AssertGptImage2Model = typeof gptImage2Model extends {
  capabilities: unknown;
} & {
  providerId: "azure-openai";
}
  ? true
  : false;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AssertGptImage2 = AssertGptImage2Model extends true ? true : never;

// `size` is narrowed to the documented Azure values.
generateImage({
  model: gptImage2Model,
  prompt: "p",
  size: "1024x1024",
});
generateImage({
  model: gptImage2Model,
  prompt: "p",
  size: "auto",
});

// Out-of-family size is a compile-time error.
// @ts-expect-error "4096x4096" is not in AzureGptImage2Params["size"]
generateImage({ model: gptImage2Model, prompt: "p", size: "4096x4096" });

// Out-of-family n is a compile-time error.
// @ts-expect-error Azure gpt-image-2 only supports n=1
generateImage({ model: gptImage2Model, prompt: "p", n: 2 });

// Out-of-namespace providerOptions is a compile-time error.
// @ts-expect-error AzureGptImage2Params only allows the `azure` namespace
generateImage({
  model: gptImage2Model,
  prompt: "p",
  providerOptions: { aliyun: { watermark: false } },
});

// String fallback overload returns the untyped default.
declare const dynamicId: string;
const dynamicModel = azure.image(dynamicId);
generateImage({
  model: dynamicModel,
  prompt: "p",
  size: "anything-goes",
  n: 4,
});

// `submitImageTask` honours the same narrowing.
submitImageTask({ model: gptImage2Model, prompt: "p", size: "1024x1536" });
// @ts-expect-error "8K" is not in AzureGptImage2Params["size"]
submitImageTask({ model: gptImage2Model, prompt: "p", size: "8K" });

// Sanity: AzureGptImage2Params extends ImageGenerationInput.
const sample: AzureGptImage2Params = { prompt: "p" };
const _check: ImageGenerationInput = sample;
void _check;
