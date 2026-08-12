# sdk-package-foundation Specification

## Purpose
TBD - created by archiving change phase-0-sdk-foundation. Update Purpose after archive.
## Requirements
### Requirement: Core package exposes a modality-neutral alpha contract
The `@ai-media/sdk` package SHALL expose TypeScript contracts for Provider/model identity, capabilities, transport, adapter requests/results, `GenerationResult<TContent>`, `TaskHandle<TContent>`, retry policy, and classified SDK errors. Image specialization SHALL use the array content form so a single generation result can carry multiple images.

#### Scenario: Core package resolves through the workspace export
- **WHEN** a workspace consumer imports `@ai-media/sdk`
- **THEN** the import resolves to the package source entry without requiring an external runtime SDK

#### Scenario: Image content specializes the generic result contract
- **WHEN** an image API type is declared in the core package
- **THEN** it uses `GenerationResult<ImageContent[]>` or `TaskHandle<ImageContent[]>` for the image modality rather than a separate non-generic task/result model, keeping `GenerationResult<TContent>` generic for other modalities

### Requirement: Core package root exports are explicit
The `@ai-media/sdk` root entry SHALL export the supported Phase 0 public contracts and image stubs; consumers SHALL NOT need to import implementation files through `src` paths.

#### Scenario: Consumer imports supported root API
- **WHEN** a consumer imports `generateImage`, `editImage`, `ImageContent`, `GenerationResult`, `TaskHandle`, or `SdkError` from `@ai-media/sdk`
- **THEN** the symbols SHALL resolve from the package root export

#### Scenario: Internal source paths are not required
- **WHEN** a consumer uses the Phase 0 API
- **THEN** the consumer SHALL not need to import from `@ai-media/sdk/src/*`

### Requirement: Runtime core remains Node-oriented
The core package runtime TypeScript configuration SHALL use the shared Node library configuration without DOM libraries or Bun-only runtime types.

#### Scenario: Browser-only globals are unavailable to runtime source
- **WHEN** core runtime source references a browser global such as `window` or `document`
- **THEN** the package typecheck SHALL reject the reference

#### Scenario: Bun test types remain isolated
- **WHEN** core tests import from `bun:test`
- **THEN** the test tsconfig SHALL provide Bun types without adding Bun runtime types to the production tsconfig

### Requirement: Core package has a passing Bun smoke test
The core package SHALL contain at least one `bun:test` test that validates a stable error or contract behavior without network access.

#### Scenario: Core smoke test runs locally
- **WHEN** the root test task runs
- **THEN** the core smoke test SHALL pass without Provider credentials or external network access

### Requirement: Image editing dispatches through a provider-bound model instance
The core `editImage` function SHALL accept an image edit request carrying a provider-bound image model instance and 1-3 input images, validate `model.capabilities.edit` and the image count against the model's `maxEditImages`, build a modality-neutral `AdapterRequest`, and dispatch to `model.adapter.edit` instead of throwing `NOT_IMPLEMENTED`.

#### Scenario: editImage dispatches to the bound adapter
- **WHEN** `editImage` is called with a request whose `model` supports editing and `images` is within `maxEditImages`
- **THEN** it SHALL build an `AdapterRequest` with the prompt and images and invoke the adapter `edit`, returning the adapter's `GenerationResult<ImageContent[]>`

#### Scenario: Non-editable model is rejected before dispatch
- **WHEN** `editImage` is called with a model whose `capabilities.edit` is false
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

#### Scenario: Out-of-range image count is rejected before dispatch
- **WHEN** `editImage` is called with zero images or more than `maxEditImages`
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

### Requirement: Image edit request carries a multi-image input contract
`ImageEditRequest` SHALL carry `model: ImageModelInstance`, `prompt: string`, and `images: ImageContent[]` (1-3 inputs). The `ImageContent` type SHALL keep `url` and `base64` (and optional `mimeType`) so providers can map each input to their native image-entry form. The Phase 0 singular `image: ImageContent` shape is retired.

#### Scenario: Edit request exposes a multi-image array
- **WHEN** a consumer constructs an `ImageEditRequest`
- **THEN** TypeScript SHALL require `model`, `prompt`, and `images` fields, and `images` SHALL be an array of `ImageContent`

#### Scenario: Single-image edit uses a one-element array
- **WHEN** a consumer edits a single image
- **THEN** it SHALL pass `images: [image]` rather than a singular `image` field

### Requirement: Async task submission dispatches through a provider-bound model instance

The core `submitTask<TContent>` function SHALL accept a task submission carrying a provider-bound model instance and a modality-neutral `AdapterRequest`, validate `model.capabilities.async`, and dispatch to `model.adapter.submit()` instead of throwing. It SHALL reject a model whose `async` capability is false/undefined with `INVALID_REQUEST` before any transport call.

#### Scenario: submitTask dispatches to the bound adapter submit

- **WHEN** `submitTask` is called with a request whose `model` declares `async: true`
- **THEN** it SHALL build an `AdapterRequest` and invoke the adapter `submit`, returning the adapter's `TaskHandle<TContent>`

#### Scenario: Non-async model is rejected before dispatch

- **WHEN** `submitTask` is called with a model whose `async` capability is false/undefined
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

### Requirement: TaskHandle wait polls a provider-supplied closure to a terminal state

The core `createTaskHandle<TContent>` helper SHALL construct a `TaskHandle<TContent>` whose `wait(options?)` loops a provider-supplied `poll()` callback until a terminal status (`succeeded`/`failed`/`cancelled`), sleeping `pollIntervalMs` (default 15000ms) between polls and timing out at `timeoutMs` (default 600000ms). `wait` SHALL accept an optional `AbortSignal` and SHALL resolve with the `GenerationResult<TContent>` on success or reject with the terminal `SdkError` on failure.

#### Scenario: wait resolves when poll reaches succeeded

- **WHEN** `poll()` returns `{ status: "succeeded", result }` after pending/running states
- **THEN** `wait()` SHALL resolve with the `result` `GenerationResult<TContent>`

#### Scenario: wait rejects when poll reaches failed

- **WHEN** `poll()` returns `{ status: "failed", error }`
- **THEN** `wait()` SHALL reject with the `error` `SdkError`

#### Scenario: wait times out when the task never terminates

- **WHEN** `poll()` never returns a terminal status within `timeoutMs`
- **THEN** `wait()` SHALL reject with an `SdkError` with code `TIMEOUT`

#### Scenario: wait respects an abort signal between polls

- **WHEN** the caller aborts the supplied `signal` while polling
- **THEN** `wait()` SHALL reject promptly without further polls

### Requirement: Provider adapter gains an optional async submit method

The `ProviderAdapter<TContent>` contract SHALL expose an optional `submit(request: AdapterRequest): Promise<TaskHandle<TContent>>` method. Sync-only Providers SHALL omit `submit`; `submitTask` SHALL fail with `INVALID_REQUEST` when the bound adapter does not implement it.

#### Scenario: submit is optional on sync-only providers

- **WHEN** a model is bound to an adapter that omits `submit`
- **THEN** `submitTask` SHALL throw an `SdkError` with code `INVALID_REQUEST` before dispatch

### Requirement: Model capability declares async support

`ModelCapability` SHALL carry an optional `async?: boolean` flag. Async-capable models (e.g. Aliyun video) SHALL set `async: true`; sync-only models SHALL leave it undefined.

#### Scenario: async capability gates submitTask

- **WHEN** a consumer calls `submitTask` on a model
- **THEN** the core SHALL dispatch only when `model.capabilities.async` is true

### Requirement: Video content specializes the generic result contract

The `@ai-media/sdk` package SHALL export a `VideoContent` type carrying `url`, optional `mimeType`, `duration`, `width`, and `height`. Video generation SHALL use `GenerationResult<VideoContent[]>` or `TaskHandle<VideoContent[]>` so a single result can carry one or more videos while `GenerationResult<TContent>` stays generic.

#### Scenario: Video content resolves through the workspace export

- **WHEN** a workspace consumer imports `VideoContent` from `@ai-media/sdk`
- **THEN** the symbol SHALL resolve from the package root export without requiring `src/*`

### Requirement: submitVideoTask binds the video modality entry

The core `submitVideoTask(request)` function SHALL accept a video request carrying a provider-bound video model instance, an optional `prompt`, the existing optional `firstFrame: ImageContent`, an optional `lastFrame: ImageContent` for i2v first & last frame, optional ordered `referenceImages: ImageContent[]`, optional ordered `referenceVideos` and `referenceAudios` entries carrying a public URL and optional duration metadata, optional `inputVideo` carrying a public video URL, optional ordered Wan 3.0 media inputs, and `providerOptions`. It SHALL validate `model.capabilities.async` and the video modality, build a modality-neutral `AdapterRequest` preserving all supplied fields, and dispatch to `model.adapter.submit()` returning a `TaskHandle<VideoContent[]>`. The core SHALL NOT validate model-specific media combinations, prompt requirements, or media-only eligibility; the bound adapter is the sole authority for those. The core SHALL reject a model that is not async and a model whose modality is not video with `INVALID_REQUEST` before dispatch.

#### Scenario: submitVideoTask forwards ordered Wan 3.0 media

- **WHEN** `submitVideoTask` is called with an async Wan 3.0 model, media entries, and no prompt
- **THEN** the adapter request SHALL preserve the ordered media entries and the absent prompt without rejecting the request in the core

#### Scenario: submitVideoTask preserves existing HappyHorse fields

- **WHEN** `submitVideoTask` is called with a HappyHorse first-frame, reference-image, or input-video request
- **THEN** the adapter request SHALL preserve the existing fields and behavior unchanged

#### Scenario: submitVideoTask preserves last-frame and reference video/audio fields

- **WHEN** `submitVideoTask` is called with a `lastFrame` image, ordered `referenceVideos`, or ordered `referenceAudios`
- **THEN** the adapter request SHALL preserve those fields unchanged and the core SHALL NOT reject the combination

#### Scenario: submitVideoTask dispatches for a t2v model

- **WHEN** `submitVideoTask` is called with an async t2v model and a non-empty prompt
- **THEN** it SHALL return a `TaskHandle<VideoContent[]>` bound to the adapter `submit`

#### Scenario: submitVideoTask dispatches for an i2v model with an empty prompt

- **WHEN** `submitVideoTask` is called with an async i2v model and an empty prompt
- **THEN** it SHALL build the adapter request and dispatch, because prompt presence is validated by the adapter, not the core

#### Scenario: submitVideoTask dispatches an r2v request

- **WHEN** `submitVideoTask` is called with an async r2v model, a non-empty prompt, and one to nine reference images
- **THEN** it SHALL return a `TaskHandle<VideoContent[]>` bound to the adapter `submit`

#### Scenario: submitVideoTask dispatches a video-edit request

- **WHEN** `submitVideoTask` is called with an async video-edit model, a non-empty prompt, and one public input video URL
- **THEN** it SHALL return a `TaskHandle<VideoContent[]>` bound to the adapter `submit`

#### Scenario: non-async model is rejected before dispatch

- **WHEN** `submitVideoTask` is called with a model whose `async` capability is false or undefined
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

#### Scenario: non-video modality model is rejected before dispatch

- **WHEN** `submitVideoTask` is called with a model whose `modality` is not `"video"`
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

### Requirement: submitImageTask binds the image async modality entry

The core `submitImageTask(request)` function SHALL accept an image async request carrying a provider-bound image model instance, a `prompt`, optional `n` and `size`, and `providerOptions`, reusing the existing `ImageGenerationRequest` type (the same shape as sync `generateImage`). It SHALL validate `model.capabilities.async` and the image modality, build a modality-neutral `AdapterRequest` with `modality: "image"` and an `ImageGenerationInput` payload, and dispatch to `model.adapter.submit()` via `submitTask<ImageContent[]>`, returning a `TaskHandle<ImageContent[]>`. It SHALL reject a non-async model, a non-image modality model, and an empty `prompt` with `INVALID_REQUEST` before dispatch.

#### Scenario: submitImageTask dispatches for an async image model

- **WHEN** `submitImageTask` is called with an async-capable image model (`modality: "image"`, `async: true`) and a non-empty prompt
- **THEN** it SHALL return a `TaskHandle<ImageContent[]>` bound to the adapter `submit`

#### Scenario: Non-async image model is rejected before dispatch

- **WHEN** `submitImageTask` is called with a model whose `async` capability is false/undefined
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

#### Scenario: Non-image modality model is rejected before dispatch

- **WHEN** `submitImageTask` is called with a model whose `modality` is not `"image"` (e.g. video)
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

#### Scenario: Empty prompt is rejected before dispatch

- **WHEN** `submitImageTask` is called with an empty prompt
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

### Requirement: submitImageTask reuses the sync image generation request type

`submitImageTask` SHALL reuse the existing `ImageGenerationRequest` (`{ model: ImageModelInstance, prompt, n?, size?, providerOptions? }`) as its public request type rather than introducing a new `ImageSubmissionRequest`. The sync `generateImage` and async `submitImageTask` entry points SHALL share the same public request contract; the dispatch path differs (sync → `adapter.generate`, async → `adapter.submit` via `submitTask`).

#### Scenario: submitImageTask accepts the same request shape as generateImage

- **WHEN** a consumer constructs a request for `submitImageTask`
- **THEN** TypeScript SHALL accept an `ImageGenerationRequest` value identical to what `generateImage` accepts, with `model`, `prompt`, optional `n`/`size`, and optional `providerOptions`

