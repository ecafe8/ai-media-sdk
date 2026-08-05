/**
 * Compile-time type tests for Aliyun Bailian family-level `image()` and
 * `video()` overloads.
 *
 * Validated by `tsc -p tsconfig.test.json`; not executed by `bun test`.
 */

import {
  generateImage,
  submitVideoTask,
  type ImageGenerationInput,
  type VideoGenerationInput,
} from "@ai-media/sdk";
import {
  createAliyunBailianProvider,
  type AliyunHappyHorseR2VParams,
  type AliyunHappyHorseT2VParams,
  type AliyunHappyHorseVideoEditParams,
  type AliyunQwenImageParams,
  type AliyunWan27ProImageParams,
} from "@ai-media/provider-aliyun-bailian";

declare const config: {
  apiKey: string;
  baseUrl: string;
};

const aliyun = createAliyunBailianProvider(config);

// Image family overloads.
const qwenModel = aliyun.image("qwen-image-2.0-pro");
generateImage({ model: qwenModel, prompt: "p", size: "2048x2048", n: 6 });
// `providerOptions.aliyun` is the Qwen-family shape.
generateImage({
  model: qwenModel,
  prompt: "p",
  providerOptions: { aliyun: { negative_prompt: "blurry" } },
});

// Out-of-namespace providerOptions is a compile-time error.
// @ts-expect-error QwenImageParams only allows the `aliyun` namespace
generateImage({ model: qwenModel, prompt: "p", providerOptions: { azure: { quality: "high" } } });

// n beyond the Qwen cap of 6 is a compile-time error.
// @ts-expect-error AliyunQwenImageParams only allows n: 1..6
generateImage({ model: qwenModel, prompt: "p", n: 7 });

// Wan 2.7 Pro overload.
const wanProModel = aliyun.image("wan2.7-image-pro");
generateImage({ model: wanProModel, prompt: "p", size: "4096x4096", n: 4 });
// @ts-expect-error AliyunWan27ProImageParams only allows n: 1..4
generateImage({ model: wanProModel, prompt: "p", n: 5 });

// Video family overloads.
const t2vModel = aliyun.video("happyhorse-1.1-t2v");
submitVideoTask({
  model: t2vModel,
  prompt: "p",
  providerOptions: { aliyun: { resolution: "1080P", ratio: "16:9", duration: 5 } },
});
// t2v ratio is constrained to the HappyHorse literal union.
// @ts-expect-error "4:1" is not a valid HappyHorse ratio
submitVideoTask({ model: t2vModel, prompt: "p", providerOptions: { aliyun: { ratio: "4:1" } } });

const r2vModel = aliyun.video("happyhorse-1.1-r2v");
submitVideoTask({
  model: r2vModel,
  prompt: "p",
  referenceImages: [{ url: "https://x/ref.png" }],
  providerOptions: { aliyun: { resolution: "720P", ratio: "9:16" } },
});
// r2v requires referenceImages.
// @ts-expect-error AliyunHappyHorseR2VParams requires referenceImages
submitVideoTask({ model: r2vModel, prompt: "p" });

const videoEditModel = aliyun.video("happyhorse-1.0-video-edit");
submitVideoTask({
  model: videoEditModel,
  prompt: "p",
  inputVideo: { url: "https://x/src.mp4" },
  providerOptions: { aliyun: { resolution: "1080P", audio_setting: "auto" } },
});
// video-edit resolution is constrained to 720P/1080P.
// @ts-expect-error video-edit family narrows resolution to "720P" | "1080P"
submitVideoTask({ model: videoEditModel, prompt: "p", inputVideo: { url: "https://x/src.mp4" }, providerOptions: { aliyun: { resolution: "480P" } } });

// String fallback overload returns the untyped default.
declare const dynamicImageId: string;
const dynamicImageModel = aliyun.image(dynamicImageId);
generateImage({ model: dynamicImageModel, prompt: "p", size: "anything" });

declare const dynamicVideoId: string;
const dynamicVideoModel = aliyun.video(dynamicVideoId);
submitVideoTask({ model: dynamicVideoModel, prompt: "p" });

// Sanity: family params extend the base input.
const qwenSample: AliyunQwenImageParams = { prompt: "p" };
const _qwenCheck: ImageGenerationInput = qwenSample;
void _qwenCheck;

const t2vSample: AliyunHappyHorseT2VParams = { prompt: "p" };
const _t2vCheck: VideoGenerationInput = t2vSample;
void _t2vCheck;

const r2vSample: AliyunHappyHorseR2VParams = {
  prompt: "p",
  referenceImages: [{ url: "https://x/r.png" }],
};
const _r2vCheck: VideoGenerationInput = r2vSample;
void _r2vCheck;

const videoEditSample: AliyunHappyHorseVideoEditParams = {
  prompt: "p",
  inputVideo: { url: "https://x/s.mp4" },
};
const _videoEditCheck: VideoGenerationInput = videoEditSample;
void _videoEditCheck;

// Re-affirm Wan27Pro params extend the base input.
const wanProSample: AliyunWan27ProImageParams = { prompt: "p" };
const _wanProCheck: ImageGenerationInput = wanProSample;
void _wanProCheck;
