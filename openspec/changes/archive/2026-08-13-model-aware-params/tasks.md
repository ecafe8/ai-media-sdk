## 1. SDK core: ModelCapability shape + pre-flight validation (Part 1)

- [x] 1.1 Extend `ModelCapability` in `packages/ai-media-sdk/src/contracts/capabilities.ts` with `supportedSizes?: readonly string[]`, `maxResolution?: { readonly width: number; readonly height: number }`, `maxN?: number`; add JSDoc linking each field to the validator behaviour.
- [x] 1.2 Refactor `validatePublicParams` in `packages/ai-media-sdk/src/image/generate.ts` to accept `ModelCapability`; thread `model.capabilities` from `generateImage` (and share it with `submitImageTask`, see Part 6).
- [x] 1.3 Implement `validateSize(input, capabilities)` and `validateN(input, capabilities)` per Decision 2 of design.md (supportedSizes case-sensitive enum first; maxResolution pixel regex `^\d+[x*]\d+$/i` + cap second; n vs maxN). Throw `SdkError` with `code: "INVALID_REQUEST"` and message naming value + allowed set or cap; no credentials/prompts in messages.
- [x] 1.4 Export `pixelSize(w, h): string` and `tierSize(tier): string` identity helpers from `packages/ai-media-sdk/src/image/request.ts`; re-export from `src/index.ts`.
- [x] 1.5 Add `packages/ai-media-sdk/tests/image-size-validation.test.ts` (Bun `bun:test`) covering: tier in/out of supportedSizes, pixel within/exceeding maxResolution, star separator, tier-then-pixel fallback when both fields defined, undefined size passes, untyped model pass-through, n within/exceeding maxN, n=0 with maxN undefined, case-sensitive lookup, helper functions.
- [x] 1.6 Run `bun run typecheck && bun run lint` at the repo root; resolve any regression.

## 2. Provider registries: fill size/maxN metadata (Part 2)

- [x] 2.1 `packages/provider-azure-openai/src/provider/registry.ts`: add `supportedSizes: ["1024x1024","1024x1536","1536x1024","auto"]` and `maxN: 1` to the `gpt-image-2` entry's `capabilities`.
- [x] 2.2 `packages/provider-aliyun-bailian/src/provider/registry.ts`: add `maxResolution`/`maxN` to each Qwen and Wan model's `capabilities` per Decision 7 table; add `supportedResolutions`/`supportedAspectRatios` fields to `AliyunModelEntry` and populate per HappyHorse table. (Follow-up `86ac362` added `qwen-image-3.0`/`wan2.6-t2i` and Wan `supportedSizes`; `24ebbe8` added `wan3.0-video` on the same fields.)
- [x] 2.3 `packages/provider-aliyun-bailian/src/provider/index.ts`: replace the hardcoded `VIDEO_RESOLUTIONS = ["480P","720P","1080P"]` and `VIDEO_EDIT_RESOLUTIONS = ["720P","1080P"]` consts with reads from `entry.supportedResolutions`; keep the `INVALID_REQUEST` throw on out-of-allowlist.
- [x] 2.4 `packages/provider-seedream/src/provider/registry.ts`: add `supportedSizes`/`maxResolution`/`maxN` to each of the Seedream models per Decision 7 table.
- [x] 2.5 Run `bun run typecheck && bun run lint`; spot-check via a quick `bun run dev` Playground request that existing call sites still work.

## 3. Per-family image(modelId) overloads + generic dispatch (Part 3)

- [x] 3.1 `packages/ai-media-sdk/src/contracts/model-instance.ts`: add phantom `_TParams = unknown` third generic to `ModelInstance`; `image/model-instance.ts` alias `ImageModelInstance<TParams = DefaultImageParams>` and the `VideoModelInstance<TParams = DefaultVideoParams>` alias (in `video/request.ts`) supply modality defaults.
- [x] 3.2 `packages/ai-media-sdk/src/image/generate.ts`: make `generateImage` generic over `TParams extends ImageGenerationInput` via `ImageGenerationRequest<TParams>`; default `TParams` keeps existing call sites compiling.
- [x] 3.3 `packages/ai-media-sdk/src/image/submit.ts`: make `submitImageTask` generic in the same pattern as `generateImage`.
- [x] 3.4 `packages/ai-media-sdk/src/video/submit.ts`: make `submitVideoTask` generic with `TParams extends VideoGenerationInput`.
- [x] 3.5 `packages/provider-azure-openai/src/provider/params.ts`: define `AzureGptImage2Params` (size literal union, `n?: 1`, `providerOptions.azure`).
- [x] 3.6 `packages/provider-azure-openai/src/provider/index.ts`: add literal overload `image(modelId: "gpt-image-2")` ahead of the `image(deployment: string)` fallback.
- [x] 3.7 `packages/provider-aliyun-bailian/src/provider/params.ts`: define Qwen/Wan image and HappyHorse/Wan 3.0 video family params. (Follow-up `86ac362` added `qwen-image-3.0` and `wan2.6-t2i` params.)
- [x] 3.8 `packages/provider-aliyun-bailian/src/provider/index.ts`: add literal overloads on `image(modelId)`/`video(modelId)` for each registered model id; preserve the `string` fallback.
- [x] 3.9 `packages/provider-seedream/src/provider/params.ts`: define Seedream family params with `size` constrained per supportedSizes literal union and `providerOptions.seedream` shape.
- [x] 3.10 `packages/provider-seedream/src/provider/index.ts`: add literal overloads on `image(modelId)` for each Seedream model id; preserve string fallback.
- [x] 3.11 Hand-written type tests per family in `packages/provider-*/tests/family-typing.test-d.ts` asserting size/n/providerOptions narrowing via `// @ts-expect-error`; validated by `bun run typecheck` (tsconfig.test.json). (MiniMax gained the same test via `add-minimax-provider`.)
- [x] 3.12 `apps/web/lib/playground/server.ts` type-checks with `provider.image(request.model)` hitting the string fallback overload; no `// @ts-expect-error` needed.

## 4. Playground: modality tabs + model-driven form (Part 4)

- [x] 4.1 `apps/web/lib/playground/types.ts`: replace `PlaygroundMode` with `PlaygroundModality` + `ImageOperation`; video operations are expressed via `VideoScenario` (multi-scenario models) and registry flags rather than a `VideoOperation` enum; extend `PlaygroundModel`/`PlaygroundRequest` accordingly.
- [x] 4.2 `apps/web/lib/playground/registry.ts`: project `supportedSizes`/`maxResolution`/`maxN` from each provider registry and `supportedResolutions`/`supportedAspectRatios`/`family` for video models.
- [x] 4.3 `apps/web/lib/playground/server.ts`: switch on `request.modality === "video"`; dispatch image generate/edit/async paths.
- [x] 4.4 `apps/web/app/api/playground/generate/route.ts`: validate `modality` + per-modality fields instead of `mode`.
- [x] 4.5 `apps/web/components/playground/lib/image-form-schema.ts`: `imageSizeOptions(model)`, `imageNOptions(model)`, `imageAdvancedFieldSet(model)`; pixel presets filtered by the cap; default = first option.
- [x] 4.6 `apps/web/components/playground/lib/video-form-schema.ts`: resolution/ratio/duration/audio_setting derivations; video-edit hides 480P/ratio/duration and shows `audio_setting` via `model.requiresInputVideo`.
- [x] 4.7 Split `apps/web/components/playground/index.tsx` into shell + `image-workbench/` + `video-workbench/` + `result-feed/` per `AGENTS.md` folder+index naming.
- [x] 4.8 Workbench dropdowns wired to the schema functions; default = `options[0].value`; reset on model change.
- [x] 4.9 "高级选项" collapsible renders the family-specific `providerOptions.<namespace>` fields per `imageAdvancedFieldSet(model)`.
- [x] 4.10 音频 tab rendered visibly disabled with `title="即将推出"` and `disabled`; no workbench.
- [x] 4.11 `apps/web/app/api/playground/generate/route.test.ts` uses the new `modality`+operation shape and covers size out-of-supportedSizes, n exceeding maxN, and tier-on-pixel-only rejection via the API route (added during Part 6 alignment).
- [x] 4.12 `bun run lint && bun run typecheck && bun run build` plus manual Playground verification.

## 5. Docs + final verification (Part 5)

- [x] 5.1 `docs/prd/sub-image-generation/tech.md` §11 open questions marked resolved (v1.3.0 changelog entry).
- [x] 5.2 `docs/prd/sub-provider-adapters/tech.md` §4 matrices gained `supportedSizes`/`maxResolution`/`maxN` columns and Aliyun video registry fields (v1.8.0 changelog entry; v1.9.0 live-docs sync).
- [x] 5.3 PRD versions bumped with changelog entries referencing this change.
- [x] 5.4 Parts committed separately (`660024f`, `8bdf474`, `f990d99`, `181a2db`, `b767a67`).

## 6. Post-drift alignment (Part 6 — added after provider extensions + site/i18n)

- [x] 6.1 Make `editImage` generic (`ImageEditRequest<TParams extends ImageEditInput>` mirroring `ImageGenerationRequest`), per the `model-family-typing` spec; add edit-path assertions to `packages/provider-aliyun-bailian/tests/family-typing.test-d.ts`.
- [x] 6.2 Thread `validatePublicParams` into `submitImageTask` so async image models (Wan 2.7/2.6) get the same size/n pre-flight as `generateImage`; cover both entry points in `tests/image-size-validation.test.ts` and the `image-param-validation` spec.
- [x] 6.3 Add the three route-level negative cases (size out of closed set, n over maxN, tier on pixel-only model) to `apps/web/app/api/playground/generate/route.test.ts`.
- [x] 6.4 Realign change artifacts with the post-implementation drift: `model-family-typing` (provider-neutral wording + MiniMax video overload + all four dispatch entry points), `model-registry-aggregation` (four registries incl. `minimaxModelRegistry`; MiniMax full-registry fields), `playground-form` (locale-neutral labels for the i18n site playground, `VideoScenario`/flag-driven video operations instead of `VideoOperation`, wan-image-2.6 advanced field set, `optimize_prompt_mode` naming, `thinking_mode` boolean), `design.md` (case-sensitive `supportedSizes`, Decision 7 table refresh, resolved Open Questions), `proposal.md` (same terminology fixes + follow-up-change notes).
- [x] 6.5 Run full gates `bun run lint && bun run typecheck && bun run build && bun run test`; fix any regression.
- [x] 6.6 Commit the alignment work and archive the change (deltas merge into `openspec/specs/`).
