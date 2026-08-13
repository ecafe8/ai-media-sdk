/**
 * Compile-time type tests for Volcengine Ark family-level `image()` overloads.
 *
 * Validated by `tsc -p tsconfig.test.json`; not executed by `bun test`.
 */

import {
  createVolcengineProvider,
  type VolcengineSeedream5LiteParams,
  type VolcengineSeedream5ProParams,
  type VolcengineSeedream40Params,
  type VolcengineSeedream45Params,
} from "@ai-media/provider-volcengine";
import {
  generateImage,
  type ImageGenerationInput,
  submitImageTask,
} from "@ai-media/sdk";

declare const config: { apiKey: string };

const volcengine = createVolcengineProvider(config);

// 5.0 Pro overload: tier enum ["1K", "2K"] (+ free-form pixel within cap).
const proModel = volcengine.image("doubao-seedream-5-0-pro-260628");
generateImage({ model: proModel, prompt: "p", size: "1K" });
generateImage({ model: proModel, prompt: "p", size: "2K" });
generateImage({ model: proModel, prompt: "p", size: "1024x1024" });
// `providerOptions.volcengine.output_format` is allowed on the 5.x family.
generateImage({
  model: proModel,
  prompt: "p",
  providerOptions: { volcengine: { output_format: "png" } },
});
// n is constrained to 1.
// @ts-expect-error VolcengineSeedream5ProParams only allows n: 1
generateImage({ model: proModel, prompt: "p", n: 2 });

// 5.0 Lite overload: tier enum ["2K", "3K", "4K"].
const liteModel = volcengine.image("doubao-seedream-5-0-lite-260128");
generateImage({ model: liteModel, prompt: "p", size: "4K" });

// 4.5 overload: tier enum ["2K", "4K"], no output_format.
const model45 = volcengine.image("doubao-seedream-4-5-251128");
generateImage({ model: model45, prompt: "p", size: "2K" });
// 4.x family omits output_format.
generateImage({
  model: model45,
  prompt: "p",
  // @ts-expect-error VolcengineSeedream45Params does not include output_format
  providerOptions: { volcengine: { output_format: "png" } },
});

// 4.0 overload: tier enum ["1K", "2K", "4K"].
const model40 = volcengine.image("doubao-seedream-4-0-250828");
generateImage({ model: model40, prompt: "p", size: "1K" });

// String fallback overload returns the untyped default.
declare const dynamicId: string;
const dynamicModel = volcengine.image(dynamicId);
generateImage({ model: dynamicModel, prompt: "p", size: "anything" });

// `submitImageTask` honours the same narrowing.
submitImageTask({ model: proModel, prompt: "p", size: "2K" });

// Sanity: each family params extends ImageGenerationInput.
const proSample: VolcengineSeedream5ProParams = { prompt: "p" };
const _proCheck: ImageGenerationInput = proSample;
void _proCheck;

const liteSample: VolcengineSeedream5LiteParams = { prompt: "p" };
const _liteCheck: ImageGenerationInput = liteSample;
void _liteCheck;

const sample45: VolcengineSeedream45Params = { prompt: "p" };
const _45Check: ImageGenerationInput = sample45;
void _45Check;

const sample40: VolcengineSeedream40Params = { prompt: "p" };
const _40Check: ImageGenerationInput = sample40;
void _40Check;
