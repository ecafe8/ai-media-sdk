/**
 * Compile-time type tests for Aliyun Bailian family-level `image()` and
 * `video()` overloads.
 *
 * Validated by `tsc -p tsconfig.test.json`; not executed by `bun test`.
 */

import {
  type AliyunHappyHorseR2VParams,
  type AliyunHappyHorseT2VParams,
  type AliyunHappyHorseVideoEditParams,
  type AliyunQwenImageParams,
  type AliyunWan3VideoParams,
  type AliyunWan26T2VParams,
  type AliyunWan27ProImageParams,
  createAliyunBailianProvider,
} from "@ai-media/provider-aliyun-bailian";
import {
  editImage,
  generateImage,
  type ImageGenerationInput,
  submitImageTask,
  submitVideoTask,
  type VideoGenerationInput,
  type Wan3VideoMediaEntry,
} from "@ai-media/sdk";

declare const config: {
  apiKey: string;
  baseUrl: string;
};

const aliyun = createAliyunBailianProvider(config);

// Image family overloads.
const qwenModel = aliyun.image("qwen-image-2.0-pro");
generateImage({ model: qwenModel, prompt: "p", size: "2048x2048", n: 6 });
generateImage({
  model: qwenModel,
  prompt: "p",
  providerOptions: { aliyun: { negative_prompt: "blurry" } },
});
const qwen30Model = aliyun.image("qwen-image-3.0");
generateImage({ model: qwen30Model, prompt: "p", n: 3, size: "1024*1024" });
generateImage({
  model: qwen30Model,
  prompt: "p",
  providerOptions: { aliyun: { prompt_extend_mode: "agent" } },
});

// Out-of-namespace providerOptions is a compile-time error.
generateImage({
  model: qwenModel,
  prompt: "p",
  // @ts-expect-error QwenImageParams only allows the `aliyun` namespace
  providerOptions: { azure: { quality: "high" } },
});

// n beyond the Qwen cap of 6 is a compile-time error.
// @ts-expect-error AliyunQwenImageParams only allows n: 1..6
generateImage({ model: qwenModel, prompt: "p", n: 7 });

// Wan 2.7 Pro overload.
const wanProModel = aliyun.image("wan2.7-image-pro");
generateImage({ model: wanProModel, prompt: "p", size: "4096x4096", n: 4 });
submitImageTask({ model: wanProModel, prompt: "p", size: "2K" });
submitImageTask({ model: wanProModel, prompt: "p", size: "4K" });
// @ts-expect-error AliyunWan27ProImageParams only allows n: 1..4
generateImage({ model: wanProModel, prompt: "p", n: 5 });

// Video family overloads.
const t2vModel = aliyun.video("happyhorse-1.1-t2v");
submitVideoTask({
  model: t2vModel,
  prompt: "p",
  providerOptions: {
    aliyun: { resolution: "1080P", ratio: "16:9", duration: 5 },
  },
});
submitVideoTask({
  model: t2vModel,
  prompt: "p",
  // @ts-expect-error "4:1" is not a valid HappyHorse ratio
  providerOptions: { aliyun: { ratio: "4:1" } },
});

const r2vModel = aliyun.video("happyhorse-1.1-r2v");
submitVideoTask({
  model: r2vModel,
  prompt: "p",
  referenceImages: [{ url: "https://x/ref.png" }],
  providerOptions: { aliyun: { resolution: "720P", ratio: "9:16" } },
});
// @ts-expect-error AliyunHappyHorseR2VParams requires referenceImages
submitVideoTask({ model: r2vModel, prompt: "p" });

const videoEditModel = aliyun.video("happyhorse-1.0-video-edit");
submitVideoTask({
  model: videoEditModel,
  prompt: "p",
  inputVideo: { url: "https://x/src.mp4" },
  providerOptions: { aliyun: { resolution: "1080P", audio_setting: "auto" } },
});
submitVideoTask({
  model: videoEditModel,
  prompt: "p",
  inputVideo: { url: "https://x/src.mp4" },
  // @ts-expect-error video-edit family narrows resolution to "720P" | "1080P"
  providerOptions: { aliyun: { resolution: "480P" } },
});

// Wan 2.6 T2I overload: pixel-only size (no tier), Qwen-style options.
const wan26Model = aliyun.image("wan2.6-t2i");
generateImage({ model: wan26Model, prompt: "p", size: "1280*1280", n: 1 });
submitImageTask({
  model: wan26Model,
  prompt: "p",
  providerOptions: {
    aliyun: { negative_prompt: "flowers", prompt_extend: true },
  },
});
submitImageTask({
  model: wan26Model,
  prompt: "p",
  // @ts-expect-error wan2.6-t2i does not support thinking_mode (wan2.7 only)
  providerOptions: { aliyun: { thinking_mode: true } },
});

// Wan 3.0 video overload.
const wan3Model = aliyun.video("wan3.0-video");
// Text-to-video.
submitVideoTask({
  model: wan3Model,
  prompt: "p",
  providerOptions: {
    aliyun: { resolution: "1080P", ratio: "16:9", duration: 5 },
  },
});
// Media-only (no prompt).
submitVideoTask({
  model: wan3Model,
  media: [
    { type: "reference_image", url: "https://x/r.png" },
    { type: "reference_video", url: "https://x/v.mp4" },
  ],
});
// Wan 3.0 uses `audio` boolean, not `audio_setting`.
submitVideoTask({
  model: wan3Model,
  prompt: "p",
  providerOptions: { aliyun: { audio: false } },
});
// Wan 3.0 ratio includes "adaptive".
submitVideoTask({
  model: wan3Model,
  prompt: "p",
  providerOptions: { aliyun: { ratio: "adaptive" } },
});
// Wan 3.0 does not accept HappyHorse's `audio_setting`.
submitVideoTask({
  model: wan3Model,
  prompt: "p",
  // @ts-expect-error Wan 3.0 uses `audio` boolean, not `audio_setting`
  providerOptions: { aliyun: { audio_setting: "auto" } },
});
// Wan 3.0 ratio does not include HappyHorse's "9:21".
submitVideoTask({
  model: wan3Model,
  prompt: "p",
  // @ts-expect-error "9:21" is not a valid Wan 3.0 ratio
  providerOptions: { aliyun: { ratio: "9:21" } },
});

// String fallback overload returns the untyped default.
declare const dynamicImageId: string;
const dynamicImageModel = aliyun.image(dynamicImageId);
generateImage({ model: dynamicImageModel, prompt: "p", size: "anything" });

// `editImage` is generic over `ImageEditInput`. No edit-family params exist
// yet, so family-typed image models fall back to the default edit shape:
// `images` stays required and the pre-change request form type-checks.
editImage({
  model: qwenModel,
  prompt: "p",
  images: [{ url: "https://x/in.png" }],
});
editImage({
  model: dynamicImageModel,
  prompt: "p",
  images: [{ url: "https://x/in.png" }],
  providerOptions: { aliyun: { negative_prompt: "blurry" } },
});
// @ts-expect-error ImageEditInput requires `images`
editImage({ model: qwenModel, prompt: "p" });

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

const wanProSample: AliyunWan27ProImageParams = { prompt: "p" };
const _wanProCheck: ImageGenerationInput = wanProSample;
void _wanProCheck;

const wan26Sample: AliyunWan26T2VParams = { prompt: "p" };
const _wan26Check: ImageGenerationInput = wan26Sample;
void _wan26Check;

const wan3Sample: AliyunWan3VideoParams = {
  media: [{ type: "reference_image", url: "https://x/r.png" }],
};
const _wan3Check: VideoGenerationInput = wan3Sample;
void _wan3Check;

declare const wan3Media: Wan3VideoMediaEntry;
void wan3Media;
