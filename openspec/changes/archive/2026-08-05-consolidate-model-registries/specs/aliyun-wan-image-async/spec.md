## MODIFIED Requirements

### Requirement: Aliyun Wan image adapter submits async tasks to the image-generation endpoint

The Aliyun adapter `submit()` SHALL route `wan-image`-family requests to `POST {baseUrl}/services/aigc/image-generation/generation` with `X-DashScope-Async: enable`, `Authorization: Bearer {apiKey}`, and `Content-Type: application/json`. It SHALL read `output.task_id` + `output.task_status` from the submit response and return a `TaskHandle<ImageContent[]>` whose poll closure polls the shared `GET /tasks/{task_id}` endpoint (the same endpoint used by HappyHorse video async). The API key SHALL NOT appear in messages or `cause`.

#### Scenario: Submit request targets the image-generation path with the async header

- **WHEN** `submit()` builds a Wan image generation request for a configured `baseUrl` and API key
- **THEN** the `TransportRequest` SHALL target `/services/aigc/image-generation/generation`, carry the `X-DashScope-Async: enable` and `Authorization: Bearer` headers, and contain a `model` + `input` body

#### Scenario: Unknown Wan model id is rejected

- **WHEN** `provider.image("not-a-real-wan-model")` is called
- **THEN** it SHALL throw an `SdkError` with code `UNKNOWN_MODEL` and SHALL not send a request

### Requirement: Aliyun Wan image config and registry declare async image capability

The Wan image adapter SHALL reuse the existing `AliyunBailianConfig` (`apiKey` + region-scoped `baseUrl`) and the same `Authorization: Bearer` transport. The in-package model registry SHALL register `wan2.7-image-pro` and `wan2.7-image` with `modality: "image"`, `generate: true`, `edit: false`, and `async: true`. The `z-image-turbo` entry SHALL NOT be present in the registry this phase because its synchronous contract is unimplemented and it lacks the `async` flag required to reach `submit()`.

#### Scenario: Wan image models bind with image and async capabilities

- **WHEN** `provider.image("wan2.7-image-pro")` or `provider.image("wan2.7-image")` is called
- **THEN** each SHALL return an `ImageModelInstance`-shaped instance whose `capabilities.modality` is `"image"` and `capabilities.async` is `true`

#### Scenario: z-image-turbo is not submitted as an async task

- **WHEN** `provider.image("z-image-turbo")` is called
- **THEN** it SHALL throw an `SdkError` with code `UNKNOWN_MODEL` (the `z-image-turbo` entry is no longer registered this phase), and `submitImageTask` SHALL never be reached for it
