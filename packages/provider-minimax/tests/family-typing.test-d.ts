/**
 * Compile-time type tests for the MiniMax `video()` overload.
 *
 * Validated by `tsc -p tsconfig.test.json`; not executed by `bun test`.
 */

import {
  createMiniMaxProvider,
  type MiniMaxH3VideoParams,
} from "@ai-media/provider-minimax";
import { submitVideoTask, type VideoGenerationInput } from "@ai-media/sdk";

declare const config: {
  apiKey: string;
};

const minimax = createMiniMaxProvider(config);

// The literal overload binds the family-typed params.
const h3Model = minimax.video("MiniMax-H3");
submitVideoTask({
  model: h3Model,
  prompt: "p",
  providerOptions: {
    minimax: { resolution: "2K", duration: 5, ratio: "16:9" },
  },
});

// i2v inputs narrow through the core contract fields.
submitVideoTask({
  model: h3Model,
  prompt: "p",
  firstFrame: { url: "https://example.com/first.png" },
  lastFrame: { url: "https://example.com/last.png" },
  providerOptions: { minimax: { resolution: "768P", duration: 4 } },
});

// r2v inputs carry reference images/videos/audios.
submitVideoTask({
  model: h3Model,
  prompt: "p",
  referenceImages: [{ url: "https://example.com/ref.png" }],
  referenceVideos: [{ url: "https://example.com/ref.mp4", duration: 4 }],
  referenceAudios: [{ url: "https://example.com/ref.mp3" }],
  providerOptions: { minimax: { resolution: "2K", duration: 15 } },
});

// `providerOptions.minimax` is required by the MiniMax-H3 params.
// @ts-expect-error MiniMaxH3VideoParams requires providerOptions.minimax
submitVideoTask({ model: h3Model, prompt: "p" });

// `prompt` is required by the MiniMax-H3 params.
// @ts-expect-error MiniMaxH3VideoParams requires a prompt
submitVideoTask({
  model: h3Model,
  providerOptions: { minimax: { resolution: "2K", duration: 5 } },
});

// resolution is a closed union.
submitVideoTask({
  model: h3Model,
  prompt: "p",
  providerOptions: {
    // @ts-expect-error resolution only allows 768P or 2K
    minimax: { resolution: "1080P", duration: 5 },
  },
});

// duration is a closed 4-15 union.
submitVideoTask({
  model: h3Model,
  prompt: "p",
  providerOptions: {
    // @ts-expect-error duration only allows 4..15
    minimax: { resolution: "2K", duration: 3 },
  },
});

// ratio is a closed union.
submitVideoTask({
  model: h3Model,
  prompt: "p",
  providerOptions: {
    // @ts-expect-error ratio must be a documented MiniMax ratio
    minimax: { resolution: "2K", duration: 5, ratio: "2:1" },
  },
});

// Out-of-namespace providerOptions is a compile-time error.
submitVideoTask({
  model: h3Model,
  prompt: "p",
  // @ts-expect-error MiniMaxH3VideoParams only allows the `minimax` namespace
  providerOptions: { aliyun: { resolution: "2K" } },
});

// The string fallback keeps the default input shape for dynamic ids.
declare const dynamicId: string;
const dynamicModel = minimax.video(dynamicId);
const defaultInput: VideoGenerationInput = { prompt: "p" };
submitVideoTask({ model: dynamicModel, ...defaultInput });

// The family params type stays assignable to the core input contract.
const params: MiniMaxH3VideoParams = {
  prompt: "p",
  providerOptions: { minimax: { resolution: "2K", duration: 5 } },
};
const asInput: VideoGenerationInput = params;
void asInput;
