## Context

See `proposal.md - Why` for the parameter-divergence problem this change addresses. The relevant codebase state shaping the design:

- `packages/ai-media-sdk/src/contracts/capabilities.ts:23` — `ModelCapability` currently only carries boolean/numeric flags (`generate`/`edit`/`maxEditImages`/`async`); no size or `maxN` metadata.
- `packages/ai-media-sdk/src/image/generate.ts:31-144` — `generateImage` whitelists `{ prompt, n, size }` and rejects unknown keys pre-flight, but `size` is opaque `string`, never validated against model capabilities. `n` is only checked for positive-integer-ness.
- `packages/ai-media-sdk/src/contracts/model-instance.ts:15` — `ModelInstance<TContent>` is parameterised only by content type; no compile-time hook for per-model params.
- `packages/provider-azure-openai/src/provider/index.ts:225-243` / `packages/provider-seedream/src/provider/index.ts:171-193` — both adapters `body.size = input.size` raw pass-through.
- `packages/provider-aliyun-bailian/src/provider/index.ts:301-309` — Aliyun adapter does `x`→`*` substitution but no value validation; the `paramSupport: { size: boolean }` flag only gates whether to forward.
- `packages/provider-aliyun-bailian/src/provider/index.ts:632-633, 775-786` — Aliyun video has hardcoded `VIDEO_RESOLUTIONS = ["480P","720P","1080P"]` and `VIDEO_EDIT_RESOLUTIONS = ["720P","1080P"]` module consts; registry-driven validation will replace them.
- `apps/web/components/playground/index.tsx:432-448, 390-393, 416-419` — hardcoded image `size`/`n` and video `resolution`/`duration` dropdowns regardless of selected model.
- `apps/web/components/playground/index.tsx:217-244` — three-button mode toggle collapses operation (generate/edit) and modality (video) into one enum.
- `apps/web/lib/playground/server.ts:60-164` — `createProviderSelection(request)` switches on `request.mode === "video"` to call `provider.video(model)` vs `provider.image(model)`; the `provider.image(request.model: string)` call hits the default (untyped) overload and will continue to do so after this change.

PRD context that constrains the design: `docs/prd/main-prd.md` §8.1 requires "请求前报错、不得静默忽略"; `docs/prd/sub-image-generation/tech.md:85` says "公共尺寸字段不应假设 `aspectRatio` 对所有模型有效，需能力化建模".

## Goals / Non-Goals

**Goals:**

- `generateImage` pre-flight rejects `size`/`n` that the selected model does not accept, with `INVALID_REQUEST`, before any transport call.
- `ModelCapability` becomes the single source of truth for size/maxN metadata that both the SDK core (for validation) and the Playground (for UI rendering) consume via the `SupportedModel` projection.
- TypeScript users who call `provider.image("known-model-id")` get IDE intellisense for `size`/`n`/`providerOptions.<namespace>` constrained to that model's family.
- Playground form is structured around a top-level modality switch (image/video/audio-disabled); within each modality, the operation is inferred from the selected model so the form's parameter set is always coherent and never has mutually-exclusive fields on screen at once.
- Backwards compatibility: existing call sites that pass a `string` model id (including Playground `server.ts`) continue to type-check and behave as before; models without declared size/maxN metadata continue to pass `size`/`n` through unchanged.

**Non-Goals:**

- Per-**model** (rather than per-**family**) TypeScript overloads. Per-model id is too granular and high-maintenance; family-level `TParams` types shared by same-family model ids (one literal overload per known registry model) cover all four Providers with the same DX value. The `string` fallback absorbs the rest.
- Lifting Aliyun video `supportedResolutions`/`supportedAspectRatios` into the common `ModelCapability`. They stay in `AliyunModelEntry` (provider-specific) because only the Aliyun adapter and Playground consume them; lifting would force every future Provider to spell out video fields.
- Changing the runtime shape of `ModelInstance`, `AdapterRequest`, or the adapter `generate`/`edit` contract. The third `TParams` generic is purely a compile-time phantom.
- Lifting `providerOptions.<namespace>` typing into the core. `providerOptions` remains `Readonly<Record<string, unknown>>` at the core; the family `TParams` does the per-model narrowing at the Provider boundary, keeping the core Provider-agnostic.
- New public SDK API surface beyond `pixelSize`/`tierSize` helpers and the now-generic `generateImage`/`editImage` signatures. No `model.generate(input)` instance method is introduced.
- Video modality switching beyond what already exists. The form refactor moves the existing video modes (t2v/i2v/r2v/video-edit) under a video-modality tab; no new video features (audio modality entry points, `generateAudio`/`submitAudioTask`) are added.
- Editing `docs/prd/sub-image-generation/prd.md` acceptance criteria or rewriting the model matrix. Only `tech.md` §11 open-question closure and §4 capability-matrix updates apply.

## Decisions

### Decision 1: Extend `ModelCapability` with `supportedSizes`/`maxResolution`/`maxN` rather than a discriminated `SizeStrategy` union

**Choice:** Three independent optional fields on `ModelCapability` (see spec `model-registry-aggregation` delta).

**Alternatives considered:**

- A discriminated union `SizeStrategy = { kind: "pixel"; max: {...} } | { kind: "tier"; values: [...] } | { kind: "tier+ratio"; tiers; ratios }`. More type-safe at the field level, but forces every model entry to pick exactly one kind — yet live contracts show several models accept **both** tier and pixel (`Seedream` `1K`/`2K`/`3K`/`4K` or `宽x高`; `Aliyun Wan` `2K`/`4K` or `宽*高`). A discriminated union cannot express "either form" without an artificial `kind: "tier-or-pixel"` arm, erasing the safety it promised.
- A `sizeStrategy?: "pixel" | "tier"` string + `acceptedSizeForms?: ("pixel"|"tier")[]`. Adds two fields that are functionally redundant with `supportedSizes`+`maxResolution` presence. Dropped.

**Rationale:** Three independent fields let each model declare only what it constrains. The validator (Decision 2) handles the four combinations (neither / only `supportedSizes` / only `maxResolution` / both) explicitly. Models accepting "either form" declare both fields; models accepting only tier declare only `supportedSizes`; models accepting only free-form pixel declare only `maxResolution`; models with no documented size constraint declare neither and pass through (backwards compat).

### Decision 2: `validateSize` precedence — `supportedSizes` first, `maxResolution` second

**Choice:** Validator algorithm (pseudocode):

```
if input.size is undefined -> pass
if caps.supportedSizes?.includes(input.size, case-sensitive) -> pass
if caps.maxResolution is defined:
    match input.size against /^(\d+)[x*](\d+)$/i
    if no match -> INVALID_REQUEST("size must be WxH or one of {supportedSizes|—}")
    if w > max.width or h > max.height -> INVALID_REQUEST("size WxH exceeds max")
    pass
if caps.supportedSizes is defined: -> INVALID_REQUEST("size not in {supportedSizes}")
// neither field defined:
pass (backwards compat)
```

`supportedSizes` lookup is case-sensitive: tier identifiers (`"1K"`, `"2K"`, `"auto"`) are matched verbatim so callers stay aligned with each Provider's documented wire format. The pixel-form regex separately accepts `x`, `X`, or `*` as the separator for free-form `WxH` values; the existing Aliyun adapter does `x`→`*` substitution at the adapter boundary, so callers may pass either separator and the adapter normalises downstream.

**Alternatives considered:**

- Case-insensitive enum match for `supportedSizes`. Rejected during implementation: tier identifiers are Provider-documented literals, and case-insensitive matching would accept spellings the wire API rejects; separator flexibility is handled by the pixel-form regex instead.
- Deferring size validation to each adapter. Rejected: PRD §8.1 demands "请求前报错" and the core already runs `validatePublicParams` pre-flight; consolidating here keeps the contract in one place and lets Playground trust the same `SupportedModel` data without re-implementing.

### Decision 3: Phantom `TParams` generic on `ModelInstance` + per-family factory overloads

**Choice:**

```ts
export interface ModelInstance<TContent, TParams = unknown> {
  // existing fields unchanged
}
export type ImageModelInstance<TParams = ImageGenerationInput> =
  ModelInstance<ImageContent[], TParams>;
```

Each Provider's `image(modelId: string): ImageModelInstance` (default) gains literal-id overloads:

```ts
image(modelId: "gpt-image-2"): ImageModelInstance<AzureGptImage2Params>;
image(modelId: "wan2.7-image-pro"): ImageModelInstance<AliyunWan27ProImageParams>;
image(modelId: "qwen-image-2.0-pro"): ImageModelInstance<AliyunQwenImageParams>;
image(modelId: "doubao-seedream-5-0-pro-260628"): ImageModelInstance<Seedream5ProParams>;
video(modelId: "MiniMax-H3"): VideoModelInstance<MiniMaxH3VideoParams>;
// one literal overload per known registry model id, across all Providers
image(modelId: string): ImageModelInstance;  // fallback, untyped
```

`generateImage` becomes:

```ts
export function generateImage<TParams extends ImageGenerationInput>(
  request: { model: ImageModelInstance<TParams> } & Omit<TParams, "model">
): Promise<GenerationResult<ImageContent[]>>;
```

The intersection `{ model } & Omit<TParams, "model">` ensures the request's `size`/`n`/`providerOptions` shapes are constrained by the bound model's `TParams`. When `TParams = ImageGenerationInput` (the default), `Omit<TParams, "model">` is `{ prompt; n?; size?; providerOptions? }` and the request shape matches the pre-change contract — no breakage. The same pattern applies to `editImage` (`TParams extends ImageEditInput`), `submitImageTask` (`TParams extends ImageGenerationInput`), and `submitVideoTask` (`TParams extends VideoGenerationInput`), so every dispatch entry point narrows consistently.

**Why `TParams = unknown` on the underlying `ModelInstance` but `ImageModelInstance` defaults to `ImageGenerationInput`:** The base `ModelInstance` is modality-neutral; image and video have different default param shapes. Specialised aliases supply the right default. Existing call sites that don't mention `TParams` get the alias's default, which keeps them compiling.

**Alternatives considered:**

- Introduce a `model.generate(input)` instance method that's typed per family, mirroring AI SDK's pattern. Rejected: doubles the public API surface (`generateImage({ model, ... })` and `model.generate({...})`), forces Playground `server.ts` and `examples/*` to pick one form, and the typing benefit is achievable with the existing `generateImage({ model, ... })` shape via the intersection type.
- Lift `providerOptions.<namespace>` typing into the core. Rejected: would force the core to import each Provider's options interfaces, breaking the "core is Provider-agnostic" rule from `model-registry-aggregation` spec. The `TParams` carries the narrowed `providerOptions` shape at the Provider boundary; the core only sees `TParams extends ImageGenerationInput` and stays generic.
- Per-model-id overloads (17 overloads). Rejected as over-engineering; family-level overloads (~6) cover the size/n/providerOptions combinations that vary in this codebase. Per-model differences within a family are documented in the registry data; Playground reads them dynamically.

### Decision 4: Playground `PlaygroundModality` + operation enums, full reset on tab switch

**Choice:** Replace `PlaygroundMode = "generate" | "edit" | "video"` (operation+modality mixed) with:

```ts
type PlaygroundModality = "image" | "video" | "audio";
type ImageOperation = "generate" | "edit";
type VideoOperation = "t2v" | "i2v" | "r2v" | "video-edit";
```

The top-level component owns `modality` state and renders `<ImageWorkbench/>` or `<VideoWorkbench/>`. Each workbench owns its own `operation` state, inferred from the selected model on model change. Tab switch unmounts the previous workbench (state lives inside it, so unmount = reset). The 音频 tab is rendered with `disabled` and a `title` tooltip.

**Rationale:** React's unmount-on-tab-switch gives the "full reset" behaviour for free without an explicit `useEffect` reset; each workbench holds its own `useState`, so swapping tabs destroys that state. This removes the parameter-mutex complexity (no more `isVideo ? <resolution/> : <size/>` ternary inside one giant form).

**Alternatives considered:**

- Keep `PlaygroundMode` and add a separate `PlaygroundModality` field. Rejected: the existing toggle already conflates the two; adding a second state without removing the first creates two sources of truth and the mutex logic stays.
- Put all state in a single reducer keyed by modality. Rejected: more code, no behaviour win over unmount-reset.

### Decision 5: Form schema modules drive dropdown options from `PlaygroundModel`

**Choice:** Add `apps/web/components/playground/lib/image-form-schema.ts` and `video-form-schema.ts` exporting pure functions:

```ts
export function imageSizeOptions(model: PlaygroundModel): readonly { value: string; label: string }[];
export function imageNOptions(model: PlaygroundModel): readonly { value: number; label: string }[];
export function videoResolutionOptions(model: PlaygroundModel): readonly { value: string; label: string }[];
export function videoRatioOptions(model: PlaygroundModel): readonly { value: string; label: string }[];
export function videoDurationOptions(model: PlaygroundModel): readonly { value: number; label: string }[];
```

Each function reads `model.supportedSizes`/`maxResolution`/`maxN`/`supportedResolutions`/`supportedAspectRatios` and returns the derived list. Workbench components call these to render dropdowns and to seed default values (`options[0].value`). The existing video-edit special-casing (no 480P, no ratio, no duration, audio_setting visible) moves into `video-form-schema.ts` based on `model.family === "happyhorse-video"` + `model.requiresInputVideo`.

**Rationale:** Pure functions are easy to unit-test in isolation and easy to call from both the form rendering and the form state initialiser. Keeping them co-located with the workbench (not in `lib/playground/`) keeps them close to the consumer; they don't belong in the SDK-adjacent `lib/playground/registry.ts` because they're UI-only.

### Decision 6: Aliyun video resolution/ratio validation moves from module consts to registry-driven

**Choice:** Add `supportedResolutions: readonly string[]` and `supportedAspectRatios: readonly string[]` to `AliyunModelEntry` (`packages/provider-aliyun-bailian/src/provider/registry.ts`). Populate per Aliyun video model (HappyHorse; Wan 3.0 was added later by its own change using the same fields). Replace the hardcoded `VIDEO_RESOLUTIONS`/`VIDEO_EDIT_RESOLUTIONS` consts in `provider/index.ts` with reads from the registry entry. The adapter continues to throw `INVALID_REQUEST` for out-of-allowlist values, just with the allowlist sourced from the registry. MiniMax later adopted the identical pattern in `MiniMaxModelEntry`.

**Rationale:** Same single-source-of-truth principle as Decision 1; Playground can read the same fields (projected via `PlaygroundModel`) to render dropdowns.

**Non-goal:** Lifting these to `ModelCapability`. They're video/Aliyun-specific; only Aliyun video consumers need them.

### Decision 7: Registry data values (filling the new fields)

Per `docs/prd/sub-provider-adapters/tech.md` §4.1/§4.3/§4.4:

| Provider / model | supportedSizes | maxResolution | maxN |
| --- | --- | --- | --- |
| Azure `gpt-image-2` | `["1024x1024","1024x1536","1536x1024","auto"]` | — | `1` |
| Aliyun `qwen-image-3.0-pro` / `qwen-image-3.0` / `qwen-image-2.0-pro` / `qwen-image-2.0-pro-2026-06-22` / `qwen-image-2.0` | — | `{ width: 2048, height: 2048 }` | `6` |
| Aliyun `wan2.7-image-pro` | `["1K","2K","4K"]` | `{ width: 4096, height: 4096 }` | `4` |
| Aliyun `wan2.7-image` | `["1K","2K"]` | `{ width: 2048, height: 2048 }` | `4` |
| Aliyun `wan2.6-t2i` | — (pixel-only, `1280*1280`–`1440*1440`) | `{ width: 1440, height: 1440 }` | `4` |
| Seedream `doubao-seedream-5-0-pro-260628` | `["1K","2K"]` | `{ width: 2048, height: 2048 }` | `1` |
| Seedream `doubao-seedream-5-0-260128` / `doubao-seedream-5-0-lite-260128` | `["2K","3K","4K"]` | `{ width: 4096, height: 4096 }` | `1` |
| Seedream `doubao-seedream-4-5-251128` | `["2K","4K"]` | `{ width: 4096, height: 4096 }` | `1` |
| Seedream `doubao-seedream-4-0-250828` | `["1K","2K","4K"]` | `{ width: 4096, height: 4096 }` | `1` |

The `wan2.7-image-pro`/`wan2.7-image` rows gained their `supportedSizes` and `qwen-image-3.0`/`wan2.6-t2i` were registered by the post-implementation live-docs alignment fix (commit `86ac362`); without the tier lists, `validateSize` rejected documented `size: "2K"` values for Wan models.

Aliyun video (`AliyunModelEntry` fields, not on `ModelCapability`):

| Model | supportedResolutions | supportedAspectRatios |
| --- | --- | --- |
| `happyhorse-1.1-t2v` | `["480P","720P","1080P"]` | `["16:9","9:16","1:1","4:3","3:4","4:5","5:4","9:21","21:9"]` |
| `happyhorse-1.1-i2v` | `["480P","720P","1080P"]` | `[]` (no ratio param) |
| `happyhorse-1.1-r2v` | `["480P","720P","1080P"]` | `["16:9","9:16","1:1","4:3","3:4","4:5","5:4","9:21","21:9"]` |
| `happyhorse-1.0-video-edit` | `["720P","1080P"]` | `[]` (no ratio/duration param) |
| `wan3.0-video` | `["480P","720P","1080P"]` | `["adaptive","16:9","4:3","1:1","3:4","9:16"]` |

MiniMax video follows the same pattern in its own registry (`MiniMaxModelEntry`, added by the follow-up `add-minimax-provider` change): `MiniMax-H3` declares `supportedResolutions: ["768P","2K"]` and `supportedAspectRatios: ["adaptive","21:9","16:9","4:3","1:1","3:4","9:16"]` plus reference-media caps.

`maxN: 1` for Seedream reflects the synchronous Ark API's single-image output per call (consistent with PRD §4.4 line 159 `n` not being a Seedream-supported public param). `maxN: 1` for Azure `gpt-image-2` reflects the live deployment's `n=1` limit.

## Risks / Trade-offs

- **Risk:** Family `TParams` interfaces drift from the registry data they describe (e.g., `AzureGptImage2Params.size` union lists `"4096x4096"` while the registry `supportedSizes` does not). → Mitigation: The `tasks.md` step for Part 3 includes a hand-written type-test (`packages/provider-azure-openai/src/provider/__type-tests__.ts` or similar) using `expectTypeOf`/`// @ts-expect-error` patterns to assert the param union equals the registry's `supportedSizes` literal tuple type. We'll add at least one assertion per family.
- **Risk:** Users may pass pixel `size: "1024x1024"` to a Seedream model that also lists `supportedSizes: ["1K","2K"]` and the validator passes it via the `maxResolution` arm — but the Seedream adapter may reject `1024x1024` because 1K tier is `1024x1024` and the model treats `1K`/`1024x1024` interchangeably. → Mitigation: Per tech.md §4.4 line 159 "档位 或 宽x高 像素值，不可混用" — the model accepts either form; the adapter will normalise. We will verify with a contract test fixture.
- **Risk:** Playground's previous single-state `mode` lives across multiple `useState` calls; refactoring into two workbench components with isolated state is a non-trivial UI change. → Mitigation: `tasks.md` Part 4 is sequenced after Parts 1–3 (SDK stabilised first); the existing API route and `server.ts` shape stay the same so the workbench refactor is purely client-side.
- **Trade-off:** Family-level overloads narrow `size` to a literal union but the runtime validator (Decision 2) accepts case-insensitive matches. A user can `// @ts-expect-error` past the union and pass a runtime-valid value that TS rejected. This is acceptable — the TS narrowing is a hint, not a security boundary; the runtime validator is the source of truth.
- **Trade-off:** Adding `maxN` to `ModelCapability` duplicates the existing `maxEditImages` semantics for the edit path (both bound the image count). The two fields are deliberately separate: `maxEditImages` caps the input reference-image count for `editImage`, `maxN` caps the output `n` for `generateImage`. They describe different things.
- **Trade-off:** The 音频 tab is visible-but-disabled with no SDK entry points. This is intentional — it signals the roadmap without committing to an API shape.

## Migration Plan

1. Land Parts 1–2 (core + registries) first. No public API breakage: new fields are optional, new validation throws `INVALID_REQUEST` only for models that declare the new metadata. Models without the metadata pass through unchanged. Existing call sites and the Playground server.ts continue to work.
2. Land Part 3 (typed overloads). No runtime change; only TS users get narrower types. The `string` fallback preserves all dynamic call sites. No migration action required from existing consumers.
3. Land Part 4 (Playground refactor). The Playground is a single client-side surface; the refactor is its own atomic change. The API route contract (`/api/playground/generate` request body) stays the same shape (`{ provider, model, mode, prompt, ... }`); only the client's component tree and state layout change. No server contract migration.
4. Land Part 5 (docs + tests). Documentation updates mark open questions as resolved; tests cover the new validator branches.

Rollback: Each part is independent. Rolling back Part 1 alone re-broadens the validator (no size/n checks); Part 2's registry fields become inert. Part 3 can be reverted by removing the overloads (string fallback remains). Part 4 can be reverted by restoring the previous `components/playground/index.tsx`. Per `AGENTS.md`, each part ends with a separate commit; revert is `git revert <hash>`.

## Open Questions

All resolved during implementation/final alignment:

- `n` literal narrowing: implemented as literal unions for every family (`n?: 1` for Azure/Seedream, `1 | 2 | 3 | 4` for Wan, `1 | … | 6` for Qwen); the runtime `validateN` cap remains the source of truth.
- `pixelSize(w, h)`/`tierSize(tier)` helpers: implemented in `image/request.ts`, exported from the SDK root, and covered by `tests/image-size-validation.test.ts`.
- Async image pre-flight: `submitImageTask` now runs the same `validatePublicParams` pre-flight as `generateImage` (added during final alignment after Wan async image models gained `supportedSizes` metadata); the `image-param-validation` spec covers both entry points.
