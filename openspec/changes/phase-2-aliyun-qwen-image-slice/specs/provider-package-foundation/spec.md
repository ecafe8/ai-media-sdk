## MODIFIED Requirements

### Requirement: Provider runtime skeletons do not call external APIs
Provider packages SHALL route external calls exclusively through the shared `Transport`. The Azure OpenAI adapter `generate` SHALL perform real Azure HTTP calls via the injected transport; the Alibaba Bailian adapter `generate` SHALL perform real Qwen-Image synchronous calls via the injected transport, while Wan-family models SHALL remain `NOT_IMPLEMENTED` stubs pending the Phase 3 async task contract. Neither Provider package SHALL depend on an external Provider runtime SDK (`openai` or DashScope).

#### Scenario: Azure adapter performs real calls through the transport
- **WHEN** the Azure adapter `generate` is invoked with valid configuration and an injected transport
- **THEN** it SHALL send an Azure image generations request through the transport and map the response to a `GenerationResult<ImageContent[]>`

#### Scenario: Aliyun Qwen adapter performs real sync calls through the transport
- **WHEN** the Aliyun adapter `generate` is invoked for a Qwen model with valid configuration and an injected transport
- **THEN** it SHALL send a Qwen `multimodal-generation/generation` request through the transport and map the response to a `GenerationResult<ImageContent[]>`

#### Scenario: Aliyun Wan models remain not implemented
- **WHEN** the Aliyun adapter `generate` or `edit` is invoked for a Wan-family model during this slice
- **THEN** it SHALL throw a classified `SdkError` with code `NOT_IMPLEMENTED`, `retryable: false`, and SHALL not invoke the transport

#### Scenario: Provider stub does not invoke injected transport when not implemented
- **WHEN** an Aliyun Wan stub is invoked with a counting transport
- **THEN** the transport call count SHALL remain zero

#### Scenario: Provider dependencies remain minimal
- **WHEN** workspace dependency metadata is inspected
- **THEN** Azure and Alibaba Provider packages SHALL depend on the core package and development tooling only, with no `openai` or DashScope runtime SDK
