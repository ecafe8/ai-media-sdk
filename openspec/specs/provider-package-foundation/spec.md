# provider-package-foundation Specification

## Purpose
TBD - created by archiving change phase-0-sdk-foundation. Update Purpose after archive.
## Requirements
### Requirement: Provider packages are independently addressable
The repository SHALL provide independent workspace package boundaries for `@ai-media/provider-azure-openai` and `@ai-media/provider-aliyun-bailian`, and each Provider package SHALL depend on `@ai-media/sdk` through a workspace dependency.

#### Scenario: Azure Provider package resolves independently
- **WHEN** a consumer imports `@ai-media/provider-azure-openai`
- **THEN** the package SHALL resolve its source entry and its core package dependency without requiring the Alibaba package

#### Scenario: Alibaba Provider package resolves independently
- **WHEN** a consumer imports `@ai-media/provider-aliyun-bailian`
- **THEN** the package SHALL resolve its source entry and its core package dependency without requiring the Azure package

### Requirement: Provider runtime skeletons do not call external APIs

Provider packages SHALL route external calls exclusively through the shared `Transport`. The Azure OpenAI adapter `generate` SHALL perform real Azure HTTP calls via the injected transport; the Azure adapter `edit` SHALL remain a `NOT_IMPLEMENTED` stub pending the multipart `/images/edits` contract. The Alibaba Bailian adapter `generate` and `edit` SHALL perform real Qwen-Image synchronous calls via the injected transport for `qwen-multimodal`-family models, while `wan-image`-family models SHALL remain `NOT_IMPLEMENTED` stubs on `generate`/`edit` pending the Wan sync path (the same `image-generation/generation` endpoint without `X-DashScope-Async`). The Doubao-Seedream adapter `generate` and `edit` SHALL perform real Volcengine Ark synchronous calls via the injected transport on the `/images/generations` endpoint. The Aliyun Bailian adapter `submit` SHALL perform real async task submission and polling via the injected transport for **both** modalities: the `video` modality (HappyHorse `video-generation/video-synthesis` submit + shared `/tasks/{task_id}` poll → `output.video_url` → `VideoContent[]`) and the `image` modality for `wan-image`-family models (Wan `image-generation/generation` submit with `X-DashScope-Async: enable` + shared `/tasks/{task_id}` poll → `output.results[].url` → `ImageContent[]`). None of the Provider packages SHALL depend on an external Provider runtime SDK (`openai`, DashScope, or the Volcengine Ark SDK).

#### Scenario: Azure adapter performs real calls through the transport

- **WHEN** the Azure adapter `generate` is invoked with valid configuration and an injected transport
- **THEN** it SHALL send an Azure image generations request through the transport and map the response to a `GenerationResult<ImageContent[]>`

#### Scenario: Azure edit stays not implemented

- **WHEN** the Azure adapter `edit` is invoked during this slice
- **THEN** it SHALL throw a classified `SdkError` with code `NOT_IMPLEMENTED`, `retryable: false`, and SHALL not invoke the transport

#### Scenario: Aliyun Qwen T2I and I2I perform real sync calls through the transport

- **WHEN** the Aliyun adapter `generate` or `edit` is invoked for a Qwen model with valid configuration and an injected transport
- **THEN** it SHALL send a Qwen `multimodal-generation/generation` request through the transport (T2I content with text only; I2I content with 1-3 images then text) and map the response to a `GenerationResult<ImageContent[]>`

#### Scenario: Alibaba adapter remains a no-network stub

- **WHEN** the Aliyun adapter `generate` or `edit` is invoked for a `wan-image`-family model during this slice
- **THEN** it SHALL throw a classified `SdkError` with code `NOT_IMPLEMENTED`, `retryable: false`, and SHALL not invoke the transport

#### Scenario: Seedream T2I and I2I perform real sync calls through the transport

- **WHEN** the Seedream adapter `generate` or `edit` is invoked for a registered Seedream model with valid configuration and an injected transport
- **THEN** it SHALL send a Volcengine Ark `/images/generations` request through the transport (T2I with no `image` field; I2I with a single string or `string[]` `image` field) and map the response to a `GenerationResult<ImageContent[]>`

#### Scenario: Aliyun video async submits and polls through the transport

- **WHEN** the Aliyun adapter `submit` is invoked for a HappyHorse video model with valid configuration and an injected transport
- **THEN** it SHALL send a `video-generation/video-synthesis` request with the `X-DashScope-Async: enable` header through the transport and return a `TaskHandle<VideoContent[]>` whose poll closure polls `/tasks/{task_id}` through the same transport

#### Scenario: Aliyun Wan image async submits and polls through the transport

- **WHEN** the Aliyun adapter `submit` is invoked for a supported `wan-image`-family model (`wan2.7-image-pro` / `wan2.7-image`) with valid configuration and an injected transport
- **THEN** it SHALL send an `image-generation/generation` request with the `X-DashScope-Async: enable` header through the transport and return a `TaskHandle<ImageContent[]>` whose poll closure polls the shared `/tasks/{task_id}` endpoint through the same transport and maps `output.results[].url` → `ImageContent[]`

#### Scenario: Provider stub does not invoke injected transport before implementation

- **WHEN** an Alibaba Provider smoke test invokes a factory or adapter stub with a counting transport
- **THEN** the transport call count SHALL remain zero

#### Scenario: Provider dependencies remain minimal

- **WHEN** workspace dependency metadata is inspected
- **THEN** Azure, Alibaba, and Seedream Provider packages SHALL depend on the core package and development tooling only, with no `openai`, DashScope, or Volcengine Ark runtime SDK

### Requirement: Provider packages use the Node library and base lint configurations
Each Phase 0 Provider package SHALL use the shared Node library TypeScript configuration and the non-React shared ESLint base configuration.

#### Scenario: Provider package typechecks as Node code
- **WHEN** a Provider package typecheck runs
- **THEN** it SHALL use Node runtime types and SHALL not require DOM or React types

### Requirement: Provider factory configuration boundaries are typed
Each Provider package SHALL define a typed configuration boundary without reading credentials or making network calls in Phase 0. Azure configuration SHALL include API key, endpoint, and API version; Alibaba configuration SHALL include API key and an optional base URL.

#### Scenario: Azure configuration shape is explicit
- **WHEN** a consumer constructs the Azure Provider configuration
- **THEN** TypeScript SHALL require `apiKey`, `endpoint`, and `apiVersion` fields

#### Scenario: Alibaba configuration shape is explicit
- **WHEN** a consumer constructs the Alibaba Provider configuration
- **THEN** TypeScript SHALL require `apiKey` and SHALL allow an optional `baseUrl`

### Requirement: Providers use the shared transport boundary
Provider adapter boundaries SHALL accept or construct the core transport abstraction and SHALL not call global `fetch` directly from adapter logic.

#### Scenario: Provider transport can be replaced in tests
- **WHEN** a Provider is constructed with a custom transport
- **THEN** the adapter boundary SHALL retain that transport for future requests without replacing it with global `fetch`

### Requirement: Aliyun extended video modes use the shared transport

The Aliyun provider SHALL route HappyHorse r2v and video-edit submissions and polls exclusively through the injected shared `Transport`, using the existing bearer authentication and async task lifecycle. It SHALL not add a DashScope or other provider runtime SDK dependency.

#### Scenario: r2v uses injected transport

- **WHEN** an r2v task is submitted with an injected transport
- **THEN** both submission and task polling SHALL be observable through that transport

#### Scenario: video-edit uses injected transport

- **WHEN** a video-edit task is submitted with an injected transport
- **THEN** both submission and task polling SHALL be observable through that transport

### Requirement: Aliyun registry exposes extended video capabilities

The Aliyun model registry SHALL expose `happyhorse-1.1-r2v` as an async video model accepting exactly 1-9 reference images and `happyhorse-1.0-video-edit` as an async video model requiring exactly one input video and accepting 0-5 reference images.

#### Scenario: Extended models bind as async video models

- **WHEN** a caller binds either supported extended model
- **THEN** the resulting model SHALL declare `modality: "video"`, `async: true`, and the corresponding media requirements

### Requirement: Aliyun adapter validates media, prompt, and URLs before transport

The Aliyun adapter SHALL be the sole authority for model-specific validation and SHALL reject invalid requests with `INVALID_REQUEST` before any transport call. It SHALL validate: media presence and exclusivity per model (t2v rejects all media; i2v requires exactly one `firstFrame`; r2v requires 1-9 `referenceImages`; video-edit requires exactly one `inputVideo` and accepts 0-5 `referenceImages`), reference-image count limits, prompt presence (required for t2v/r2v/video-edit, optional for i2v), and that every `inputVideo` URL is a non-empty `http:`/`https:` URL.

#### Scenario: r2v rejects missing or excessive reference images

- **WHEN** an r2v request has zero or more than nine reference images
- **THEN** the adapter SHALL throw `INVALID_REQUEST` and SHALL not send a request

#### Scenario: video-edit rejects a missing source video

- **WHEN** a video-edit request has no `inputVideo`
- **THEN** the adapter SHALL throw `INVALID_REQUEST` and SHALL not send a request

#### Scenario: video-edit rejects a non-HTTP source video URL

- **WHEN** a video-edit `inputVideo` URL is missing, empty, or uses a non-`http:`/`https:` protocol
- **THEN** the adapter SHALL throw `INVALID_REQUEST` and SHALL not send a request

#### Scenario: incompatible media on a t2v model is rejected

- **WHEN** a t2v request carries `firstFrame`, `referenceImages`, or `inputVideo`
- **THEN** the adapter SHALL throw `INVALID_REQUEST` and SHALL not send a request

### Requirement: Aliyun validates native option values before transport

The Aliyun adapter SHALL validate the values of forwarded native options before any transport call: `audio_setting` SHALL be `"auto"` or `"origin"`, `resolution` SHALL be a supported tier, and `duration`/`seed` SHALL be numbers within the documented ranges. Invalid values SHALL throw `INVALID_REQUEST` before transport.

#### Scenario: audio_setting is validated

- **WHEN** a video-edit request supplies `audio_setting` other than `"auto"` or `"origin"`
- **THEN** the adapter SHALL throw `INVALID_REQUEST` and SHALL not send a request

#### Scenario: invalid resolution is rejected

- **WHEN** a video-edit request supplies `resolution` outside `720P`/`1080P`
- **THEN** the adapter SHALL throw `INVALID_REQUEST` and SHALL not send a request

