/**
 * Compile-time type tests for Doubao-Seedream family-level `image()` overloads.
 *
 * Validated by `tsc -p tsconfig.test.json`; not executed by `bun test`.
 */

import {
  generateImage,
  submitImageTask,
  type ImageGenerationInput,
} from "@ai-media/sdk";
import {
  createSeedreamProvider,
  type Seedream40Params,
  type Seedream45Params,
  type Seedream5LiteParams,
  type Seedream5ProParams,
} from "@ai-media/provider-seedream";

declare const config: { apiKey: string };

const seedream = createSeedreamProvider(config);

// 5.0 Pro overload: tier enum ["1K", "2K"] (+ free-form pixel within cap).
const proModel = seedream.image("doubao-seedream-5-0-pro-260628");
generateImage({ model: proModel, prompt: "p", size: "1K" });
generateImage({ model: proModel, prompt: "p", size: "2K" });
generateImage({ model: proModel, prompt: "p", size: "1024x1024" });
// `providerOptions.seedream.output_format` is allowed on the 5.x family.
generateImage({
  model: proModel,
  prompt: "p",
  providerOptions: { seedream: { output_format: "png" } },
});
// n is constrained to 1.
// @ts-expect-error Seedream5ProParams only allows n: 1
generateImage({ model: proModel, prompt: "p", n: 2 });

// 5.0 Lite overload: tier enum ["2K", "3K", "4K"].
const liteModel = seedream.image("doubao-seedream-5-0-lite-260128");
generateImage({ model: liteModel, prompt: "p", size: "4K" });

// 4.5 overload: tier enum ["2K", "4K"], no output_format.
const model45 = seedream.image("doubao-seedream-4-5-251128");
generateImage({ model: model45, prompt: "p", size: "2K" });
// 4.x family omits output_format.
generateImage({
  model: model45,
  prompt: "p",
  // @ts-expect-error Seedream45Params does not include output_format
  providerOptions: { seedream: { output_format: "png" } },
});

// 4.0 overload: tier enum ["1K", "2K", "4K"].
const model40 = seedream.image("doubao-seedream-4-0-250828");
generateImage({ model: model40, prompt: "p", size: "1K" });

// String fallback overload returns the untyped default.
declare const dynamicId: string;
const dynamicModel = seedream.image(dynamicId);
generateImage({ model: dynamicModel, prompt: "p", size: "anything" });

// `submitImageTask` honours the same narrowing.
submitImageTask({ model: proModel, prompt: "p", size: "2K" });

// Sanity: each family params extends ImageGenerationInput.
const proSample: Seedream5ProParams = { prompt: "p" };
const _proCheck: ImageGenerationInput = proSample;
void _proCheck;

const liteSample: Seedream5LiteParams = { prompt: "p" };
const _liteCheck: ImageGenerationInput = liteSample;
void _liteCheck;

const sample45: Seedream45Params = { prompt: "p" };
const _45Check: ImageGenerationInput = sample45;
void _45Check;

const sample40: Seedream40Params = { prompt: "p" };
const _40Check: ImageGenerationInput = sample40;
void _40Check;
