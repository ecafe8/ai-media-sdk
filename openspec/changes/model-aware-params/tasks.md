## 1. SDK core: ModelCapability shape + pre-flight validation (Part 1)

- [ ] 1.1 Extend `ModelCapability` in `packages/ai-media-sdk/src/contracts/capabilities.ts` with `supportedSizes?: readonly string[]`, `maxResolution?: { readonly width: number; readonly height: number }`, `maxN?: number`; add JSDoc linking each field to the validator behaviour.
- [ ] 1.2 Refactor `validatePublicParams` in `packages/ai-media-sdk/src/image/generate.ts` to accept `ModelCapability`; thread `model.capabilities` from `generateImage` and `editImage`.
- [ ] 1.3 Implement `validateSize(input, capabilities)` and `validateN(input, capabilities)` per Decision 2 of design.md (supportedSizes case-insensitive enum first; maxResolution pixel regex `^\d+[x*]\d+$/i` + cap second; n vs maxN). Throw `SdkError` with `code: "INVALID_REQUEST"` and message naming value + allowed set or cap; no credentials/prompts in messages.
- [ ] 1.4 Export `pixelSize(w, h): string` and `tierSize(tier): string` identity helpers from `packages/ai-media-sdk/src/image/request.ts` (or a new `image/size-helpers.ts`); re-export from `src/index.ts`.
- [ ] 1.5 Add `packages/ai-media-sdk/src/image/generate.size-validation.test.ts` (Bun `bun:test`) covering: tier in/out of supportedSizes, pixel within/exceeding maxResolution, star separator, tier-then-pixel fallback when both fields defined, undefined size passes, untyped model pass-through, n within/exceeding maxN, n=0 with maxN undefined.
- [ ] 1.6 Run `bun run typecheck && bun run lint` at the repo root; resolve any regression.

## 2. Provider registries: fill size/maxN metadata (Part 2)

- [ ] 2.1 `packages/provider-azure-openai/src/provider/registry.ts`: add `supportedSizes: ["1024x1024","1024x1536","1536x1024","auto"]` and `maxN: 1` to the `gpt-image-2` entry's `capabilities` (mutate `GPT_IMAGE_2_CAPABILITY` const).
- [ ] 2.2 `packages/provider-aliyun-bailian/src/provider/registry.ts`: add `maxResolution`/`maxN` to each Qwen and Wan model's `capabilities` per Decision 7 table; add `supportedResolutions`/`supportedAspectRatios` fields to `AliyunModelEntry` and populate per HappyHorse table.
- [ ] 2.3 `packages/provider-aliyun-bailian/src/provider/index.ts`: replace the hardcoded `VIDEO_RESOLUTIONS = ["480P","720P","1080P"]` and `VIDEO_EDIT_RESOLUTIONS = ["720P","1080P"]` consts with reads from `entry.supportedResolutions`; keep the `INVALID_REQUEST` throw on out-of-allowlist.
- [ ] 2.4 `packages/provider-seedream/src/provider/registry.ts`: add `supportedSizes`/`maxResolution`/`maxN` to each of the 5 Seedream models per Decision 7 table.
- [ ] 2.5 Run `bun run typecheck && bun run lint`; spot-check via a quick `bun run dev` Playground request that existing call sites still work.

## 3. Per-family image(modelId) overloads + generic generateImage (Part 3)

- [ ] 3.1 `packages/ai-media-sdk/src/contracts/model-instance.ts`: add `TParams = unknown` third generic to `ModelInstance`; update `image/model-instance.ts` alias `ImageModelInstance<TParams = ImageGenerationInput>` and `video/model-instance.ts` alias `VideoModelInstance<TParams = VideoGenerationInput>` (check current alias location and adjust).
- [ ] 3.2 `packages/ai-media-sdk/src/image/generate.ts`: make `generateImage` generic `generateImage<TParams extends ImageGenerationInput>(request: { model: ImageModelInstance<TParams> } & Omit<TParams, "model">)`; do the same for `editImage` with `ImageEditInput`. Ensure default `TParams` keeps existing call sites compiling.
- [ ] 3.3 `packages/ai-media-sdk/src/image/submit.ts`: make `submitImageTask` generic in the same pattern as `generateImage`.
- [ ] 3.4 `packages/ai-media-sdk/src/video/submit.ts`: make `submitVideoTask` generic with `TParams extends VideoGenerationInput`.
- [ ] 3.5 `packages/provider-azure-openai/src/provider/params.ts` (new file): define `AzureGptImage2Params` interface extending `ImageGenerationInput` with `size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto"`, `n?: 1`, `providerOptions?: { readonly azure?: AzureImageProviderOptions }`.
- [ ] 3.6 `packages/provider-azure-openai/src/provider/index.ts`: add literal overload `image(modelId: "gpt-image-2"): ImageModelInstance<ImageContent[], AzureGptImage2Params>` ahead of the existing `image(deployment: string): ImageModelInstance` fallback; keep `createModel` unchanged.
- [ ] 3.7 `packages/provider-aliyun-bailian/src/provider/params.ts` (new file): define `AliyunQwenImageParams`, `AliyunWan27ImageProParams`, `AliyunWan27ImageParams`, plus `AliyunHappyHorseT2VParams`/`I2VParams`/`R2VParams`/`VideoEditParams` for video. Constrain `size` per supportedSizes/maxResolution, `providerOptions.aliyun` per `AliyunImageProviderOptions`/`AliyunVideoProviderOptions`.
- [ ] 3.8 `packages/provider-aliyun-bailian/src/provider/index.ts`: add literal overloads on `image(modelId)` for each Qwen/Wan model id and on `video(modelId)` for each HappyHorse model id; preserve `image(modelId: string)`/`video(modelId: string)` fallback.
- [ ] 3.9 `packages/provider-seedream/src/provider/params.ts` (new file): define `Seedream5ProParams`, `Seedream5LiteParams`, `Seedream45Params`, `Seedream40Params` with `size` constrained per supportedSizes literal union and `providerOptions.seedream` shape.
- [ ] 3.10 `packages/provider-seedream/src/provider/index.ts`: add literal overloads on `image(modelId)` for each Seedream model id; preserve string fallback.
- [ ] 3.11 Add a hand-written type-test per family using `// @ts-expect-error` patterns (e.g. `packages/provider-azure-openai/src/provider/params.test-d.ts` or co-located `__type_tests__`) asserting: `image("gpt-image-2")` rejects `size: "4096x4096"`; `seedream.image("doubao-seedream-5-0-pro-260628")` rejects `size: "4K"`; `aliyun.image("qwen-image-2.0-pro")` rejects `providerOptions: { azure: ... }`. Run via `bun run typecheck` (TS type-only tests are validated by typecheck, not bun:test).
- [ ] 3.12 Verify `apps/web/lib/playground/server.ts` still type-checks: `provider.image(request.model)` with `request.model: string` hits the fallback overload returning default `TParams`; no `// @ts-expect-error` should be needed in server.ts.

## 4. Playground: modality tabs + model-driven form (Part 4)

- [ ] 4.1 `apps/web/lib/playground/types.ts`: replace `PlaygroundMode` with `PlaygroundModality = "image" | "video" | "audio"`, `ImageOperation = "generate" | "edit"`, `VideoOperation = "t2v" | "i2v" | "r2v" | "video-edit"`; extend `PlaygroundModel` with `supportedSizes?`, `maxResolution?`, `maxN?`, `supportedResolutions?`, `supportedAspectRatios?`, `family?`; extend `PlaygroundRequest` to carry `modality` + `imageOperation?`/`videoOperation?` instead of `mode`.
- [ ] 4.2 `apps/web/lib/playground/registry.ts`: project the new `supportedSizes`/`maxResolution`/`maxN` from each provider registry into `PlaygroundModel`; project `supportedResolutions`/`supportedAspectRatios`/`family` from `ALIYUN_MODEL_REGISTRY` for Aliyun models; `family` for Azure/Seedream can be derived (`"azure-gpt-image"` / `"doubao-seedream"`).
- [ ] 4.3 `apps/web/lib/playground/server.ts`: update `createProviderSelection` to switch on `request.modality === "video"` instead of `request.mode === "video"`; keep the rest of the provider construction logic identical; update `executePlaygroundRequest` to read `request.imageOperation`/`request.videoOperation` instead of `request.mode`.
- [ ] 4.4 `apps/web/app/api/playground/generate/route.ts`: update zod schema to validate `modality` + per-modality operation fields instead of `mode`; keep request body shape stable for the client.
- [ ] 4.5 Create `apps/web/components/playground/lib/image-form-schema.ts` exporting `imageSizeOptions(model)`, `imageNOptions(model)`, `imageAdvancedFieldSet(model)` per Decision 5; pixel presets for `maxResolution`-only models drawn from a constant list filtered by the cap; default = first option.
- [ ] 4.6 Create `apps/web/components/playground/lib/video-form-schema.ts` exporting `videoResolutionOptions(model)`, `videoRatioOptions(model)`, `videoDurationOptions(model)`, `videoAudioSettingOptions(model)`; video-edit hides 480P/ratio/duration and shows `audio_setting` based on `model.requiresInputVideo`.
- [ ] 4.7 Split `apps/web/components/playground/index.tsx` into: `index.tsx` (shell: header + modality tabs + workbench router + result feed mount), `image-workbench/index.tsx` (owns imageOperation state, image form, advanced options collapse, calls API), `video-workbench/index.tsx` (owns videoOperation state, video form, advanced options collapse, calls API), `result-feed/index.tsx` (extracted from current SuccessState/EmptyState/ProcessingState/FailureState). Follow `AGENTS.md` folder+index naming.
- [ ] 4.8 Wire workbench dropdowns to the schema functions; ensure default selected value = `options[0].value` on model change; reset on model change.
- [ ] 4.9 Add a "高级选项" collapsible (use shadcn `collapsible` if available via `bunx --bun shadcn@latest add collapsible --cwd packages/ui`, else a simple `<details>` element) rendering the family-specific `providerOptions.<namespace>` fields per `imageAdvancedFieldSet(model)`/`videoAdvancedFieldSet(model)`.
- [ ] 4.10 Render the 音频 tab visibly disabled with `title="即将推出"` and `disabled` attribute; do not render a workbench for it.
- [ ] 4.11 Update `apps/web/app/api/playground/generate/route.ts.test.ts` (and any client-side fixtures) to use the new `modality`+operation request shape; add cases: size out-of-supportedSizes rejected, n exceeding maxN rejected, tier value on pixel-only model rejected (validates core pre-flight path via the API route).
- [ ] 4.12 Run `bun run lint && bun run typecheck && bun run build`; `bun run dev` and manually verify: switch modality tabs reset form; size dropdown changes per model; defaults are first option; advanced options show correct fields per family.

## 5. Docs + final verification (Part 5)

- [ ] 5.1 `docs/prd/sub-image-generation/tech.md` §11: strike "公共参数首期包含哪些尺寸、质量、数量和格式字段" and mark resolved with reference to the `image-param-validation` capability.
- [ ] 5.2 `docs/prd/sub-provider-adapters/tech.md` §4.1/§4.3/§4.4: append a `supportedSizes`/`maxResolution`/`maxN` column to each Provider's model matrix; note Aliyun video `supportedResolutions`/`supportedAspectRatios` on `AliyunModelEntry`.
- [ ] 5.3 Bump `docs/prd/sub-provider-adapters/prd.md` and `tech.md` version + add a changelog entry referencing this change.
- [ ] 5.4 Final repo-wide `bun run lint && bun run typecheck && bun run build`; commit each part separately per `AGENTS.md` (one commit per Part 1–5, no push, no amend).
