## MODIFIED Requirements

### Requirement: Provider runtime skeletons do not call external APIs

Provider packages SHALL route external calls exclusively through the shared `Transport`. The Azure OpenAI adapter `generate` SHALL perform real Azure HTTP calls via the injected transport; the Azure adapter `edit` SHALL remain a `NOT_IMPLEMENTED` stub pending the multipart `/images/edits` contract. The Alibaba Bailian adapter `generate` and `edit` SHALL perform real Qwen-Image synchronous calls via the injected transport for `qwen-multimodal`-family models, while `wan-image`-family models SHALL remain `NOT_IMPLEMENTED` stubs on `generate`/`edit` pending the Wan sync path. The Alibaba Bailian Provider SHALL additionally perform synchronous and SSE streaming audio TTS calls for supported Qwen-Audio-TTS, CosyVoice, Qwen-TTS, and MiniMax models, plus voice cloning/design resource-manager operations through the injected transport for supported Alibaba models and actions. WebSocket realtime TTS is not part of this HTTP Provider boundary. The Doubao-Seedream adapter `generate` and `edit` SHALL perform real Volcengine Ark synchronous calls via the injected transport on the `/images/generations` endpoint. The Aliyun Bailian adapter `submit` SHALL perform real async task submission and polling via the injected transport for both existing image/video modalities. None of the Provider packages SHALL depend on an external Provider runtime SDK (`openai`, DashScope, or the Volcengine Ark SDK).

#### Scenario: Aliyun audio generation performs a real transport call
- **WHEN** the Alibaba audio adapter is invoked with valid TTS input
- **THEN** it SHALL send the documented audio TTS request through the injected transport and map the response to normalized audio content

#### Scenario: Aliyun voice cloning uses the shared transport
- **WHEN** a supported voice cloning operation is invoked with valid input
- **THEN** the provider SHALL send the documented customization action through the injected transport and normalize the response

#### Scenario: Aliyun voice design uses the shared transport
- **WHEN** a supported voice design operation is invoked with valid input
- **THEN** the provider SHALL send the documented customization action through the injected transport and normalize the response, including preview audio when returned

#### Scenario: Aliyun MiniMax TTS uses the shared transport
- **WHEN** a supported MiniMax speech model is invoked with valid non-realtime or SSE input
- **THEN** the provider SHALL send the documented multimodal generation request through the injected transport and map the response to normalized audio content

#### Scenario: HTTP Provider boundary rejects WebSocket realtime TTS
- **WHEN** a caller selects a WebSocket-only realtime TTS model through the HTTP audio path
- **THEN** the provider SHALL reject it before attempting an HTTP request

#### Scenario: Azure adapter performs real calls through the transport
- **WHEN** the Azure adapter `generate` is invoked with valid configuration and an injected transport
- **THEN** it SHALL send an Azure image generations request through the transport and map the response to a `GenerationResult<ImageContent[]>`

#### Scenario: Azure edit stays not implemented
- **WHEN** the Azure adapter `edit` is invoked during this slice
- **THEN** it SHALL throw a classified `SdkError` with code `NOT_IMPLEMENTED`, `retryable: false`, and SHALL not invoke the transport

#### Scenario: Aliyun Qwen image generation and editing use the transport
- **WHEN** the Aliyun adapter `generate` or `edit` is invoked for a Qwen image model with valid configuration and an injected transport
- **THEN** it SHALL send the documented Qwen image request through the transport and map the response to a `GenerationResult<ImageContent[]>`

#### Scenario: Aliyun Wan image sync remains unsupported
- **WHEN** the Aliyun adapter `generate` or `edit` is invoked for a Wan image model without the async image entry point
- **THEN** it SHALL throw `NOT_IMPLEMENTED` and SHALL not invoke the transport

#### Scenario: Seedream image generation and editing use the transport
- **WHEN** the Seedream adapter `generate` or `edit` is invoked for a registered model with valid configuration and an injected transport
- **THEN** it SHALL send the documented Volcengine Ark request through the transport and map the response to a `GenerationResult<ImageContent[]>`

#### Scenario: Aliyun existing video tasks submit and poll through the transport
- **WHEN** an Aliyun video task is submitted for a supported HappyHorse or Wan video model
- **THEN** submission and task polling SHALL use the injected transport and map the completed result to the existing video content contract

#### Scenario: Provider stubs do not invoke transport
- **WHEN** a Provider smoke test invokes an unimplemented adapter path with a counting transport
- **THEN** the transport call count SHALL remain zero

#### Scenario: Aliyun provider configuration remains typed
- **WHEN** a caller constructs the Alibaba Provider configuration
- **THEN** TypeScript SHALL require an API key and SHALL accept the configured regional base URL

#### Scenario: Provider packages use Node-only tooling
- **WHEN** a Provider package typecheck runs
- **THEN** it SHALL use Node runtime types and SHALL not require DOM or React types

#### Scenario: Provider transport is replaceable in tests
- **WHEN** a Provider is constructed with a custom transport
- **THEN** all image, video, audio, cloning, and design calls SHALL retain and use that transport rather than global `fetch`

#### Scenario: Extended Aliyun video modes retain shared transport behavior
- **WHEN** an r2v or video-edit task is submitted with an injected transport
- **THEN** both submission and task polling SHALL be observable through that transport

#### Scenario: Aliyun registry retains existing extended video capabilities
- **WHEN** a caller binds `happyhorse-1.1-r2v` or `happyhorse-1.0-video-edit`
- **THEN** the model SHALL remain an async video model with its existing reference-image or input-video requirements

#### Scenario: Existing Aliyun video validation remains preflight
- **WHEN** an existing Aliyun video request has invalid media, prompt, URL, or native option values
- **THEN** the adapter SHALL throw `INVALID_REQUEST` before any transport call

#### Scenario: Existing Aliyun OSS resolution remains intact
- **WHEN** an existing image or video request contains an `oss://` media URL
- **THEN** the provider SHALL inject `X-DashScope-OssResourceResolve: enable`, and SHALL omit it for requests without such URLs

#### Scenario: Provider dependencies remain minimal
- **WHEN** workspace dependency metadata is inspected
- **THEN** the Alibaba Provider package SHALL depend on the core package and development tooling only, with no DashScope or other provider runtime SDK
