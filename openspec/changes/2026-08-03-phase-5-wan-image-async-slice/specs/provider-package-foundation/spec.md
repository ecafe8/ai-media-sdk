## MODIFIED Requirements

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

#### Scenario: Aliyun Wan sync generate and edit stay not implemented

- **WHEN** the Aliyun adapter `generate` or `edit` is invoked for a `wan-image`-family model during this slice
- **THEN** it SHALL throw a classified `SdkError` with code `NOT_IMPLEMENTED`, `retryable: false`, and SHALL not invoke the transport

#### Scenario: Seedream T2I and I2I perform real sync calls through the transport

- **WHEN** the Seedream adapter `generate` or `edit` is invoked for a registered Seedream model with valid configuration and an injected transport
- **THEN** it SHALL send a Volcengine Ark `/images/generations` request through the transport (T2I with no `image` field; I2I with a single string or `string[]` `image` field) and map the response to a `GenerationResult<ImageContent[]>`

#### Scenario: Aliyun video async submits and polls through the transport

- **WHEN** the Aliyun adapter `submit` is invoked for a HappyHorse video model with valid configuration and an injected transport
- **THEN** it SHALL send a `video-generation/video-synthesis` request with the `X-DashScope-Async: enable` header through the transport and return a `TaskHandle<VideoContent[]>` whose poll closure polls `/tasks/{task_id}` through the same transport

#### Scenario: Aliyun Wan image async submits and polls through the transport

- **WHEN** the Aliyun adapter `submit` is invoked for a `wan-image`-family model (`wan2.7-image-pro` / `wan2.7-image` / `z-image-turbo`) with valid configuration and an injected transport
- **THEN** it SHALL send an `image-generation/generation` request with the `X-DashScope-Async: enable` header through the transport and return a `TaskHandle<ImageContent[]>` whose poll closure polls the shared `/tasks/{task_id}` endpoint through the same transport and maps `output.results[].url` → `ImageContent[]`

#### Scenario: Provider stub does not invoke injected transport before implementation

- **WHEN** an Alibaba Provider smoke test invokes a factory or adapter stub with a counting transport
- **THEN** the transport call count SHALL remain zero

#### Scenario: Provider dependencies remain minimal

- **WHEN** workspace dependency metadata is inspected
- **THEN** Azure, Alibaba, and Seedream Provider packages SHALL depend on the core package and development tooling only, with no `openai`, DashScope, or Volcengine Ark runtime SDK
