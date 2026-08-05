# azure-image-generation Specification

## Purpose
End-to-end Azure OpenAI text-to-image generation through the shared transport: provider-bound image model instance dispatch, Azure request building, sync response mapping, and HTTP error classification. Alibaba remains a stub pending live DashScope contract discovery.
## Requirements
### Requirement: Image generation dispatches through a provider-bound model instance
The core `generateImage` function SHALL accept an image generation request carrying a provider-bound image model instance (produced by `provider.image(modelOrDeployment)` or `createAzureModel(provider, deployment, capabilities?)`), validate public parameters against the instance capabilities, and dispatch to the instance's adapter `generate` instead of throwing `NOT_IMPLEMENTED`.

#### Scenario: generateImage dispatches to the bound adapter
- **WHEN** `generateImage` is called with a request whose `model` is an image model instance bound to a Provider adapter
- **THEN** it SHALL build a modality-neutral `AdapterRequest` and invoke the adapter `generate`, returning the adapter's `GenerationResult<ImageContent[]>`

#### Scenario: editImage remains not implemented in this slice
- **WHEN** `editImage` is invoked during this slice
- **THEN** it SHALL throw a classified `SdkError` with code `NOT_IMPLEMENTED` and `retryable: false`, and SHALL not perform a network request

#### Scenario: Image model instance is produced by the provider factory
- **WHEN** a Provider's `image(modelOrDeployment)` is called
- **THEN** it SHALL return an image model instance carrying `providerId`, `modelId`, the bound adapter, and model capabilities

#### Scenario: Unknown Azure deployment is rejected with UNKNOWN_MODEL
- **WHEN** `provider.image("not-a-real-deployment")` is called and the deployment is not in the Azure known-deployment whitelist
- **THEN** it SHALL throw an `SdkError` with code `UNKNOWN_MODEL` whose message hints at `createAzureModel()` for custom deployments, and SHALL not send a request

#### Scenario: Known Azure deployment binds with registry capabilities
- **WHEN** `provider.image("gpt-image-2")` is called
- **THEN** it SHALL return an `ImageModelInstance` whose `capabilities` come from the Azure known-deployment registry entry (`modality: "image"`, `generate: true`, `edit: false`)

#### Scenario: createAzureModel binds a custom deployment
- **WHEN** `createAzureModel(provider, "my-custom-deploy", { modality: "image", generate: true, edit: true })` is called
- **THEN** it SHALL return an `ImageModelInstance` bound to the provider adapter, carrying the supplied capabilities and bypassing the known-deployment whitelist

#### Scenario: generate re-validates the registry entry defensively
- **WHEN** the adapter `generate` is dispatched for a deployment that is neither in the whitelist nor registered via `createAzureModel`
- **THEN** it SHALL throw an `SdkError` with code `UNKNOWN_MODEL` before building the request URL, and SHALL not invoke the transport

### Requirement: Azure adapter builds the image generations request via the shared transport
The Azure OpenAI adapter `generate` SHALL construct `POST {endpoint}/openai/deployments/{deployment}/images/generations?api-version={apiVersion}` with an `Authorization: Bearer {apiKey}` header and a JSON body derived from the public parameters and the `providerOptions.azure` namespace, and SHALL send it through the injected shared `Transport` rather than global `fetch`.

#### Scenario: Azure request URL and auth header are correct
- **WHEN** the Azure adapter builds a generation request for a configured deployment and API version
- **THEN** the `TransportRequest` SHALL target the deployments images/generations path with the `api-version` query, carry the `Authorization: Bearer` header using the API key from configuration, and contain a JSON body with the prompt

#### Scenario: Public parameters map to the Azure request body
- **WHEN** the adapter maps a request with `prompt`, `n`, and `size`
- **THEN** the JSON body SHALL include `prompt`, `n`, and `size` derived from the public parameters

#### Scenario: Azure-native options forward through the provider namespace
- **WHEN** the request supplies `providerOptions.azure` with `quality`, `output_format`, or `output_compression`
- **THEN** the adapter SHALL forward those fields into the Azure request body and SHALL NOT expose them as public parameters

#### Scenario: Azure adapter does not call global fetch
- **WHEN** the Azure adapter executes a generation with an injected counting transport
- **THEN** it SHALL send exactly through the injected transport and SHALL not reference global `fetch`

### Requirement: Azure sync response maps to multiple image content results
The Azure adapter SHALL map the synchronous `data[]` response (`url` and/or `b64_json`) into a `GenerationResult<ImageContent[]>` carrying one `ImageContent` per returned image, plus provider/model identifiers and non-sensitive metadata.

#### Scenario: URL response maps to image content
- **WHEN** Azure returns `data[].url` for one or more images
- **THEN** the result `content` SHALL be an array of `ImageContent` each carrying the `url`, and SHALL include the provider id, model id, and a request id when available

#### Scenario: Base64 response maps to image content
- **WHEN** Azure returns `data[].b64_json`
- **THEN** the result `content` SHALL be an array of `ImageContent` each carrying the `base64` payload

### Requirement: Azure HTTP failures classify to stable SDK error codes
The Azure adapter SHALL classify non-2xx responses and transport failures into `SdkError` codes via the shared classifier: 401/403 → `AUTH_ERROR`, 429 → `RATE_LIMITED`, 400/413/422 → `INVALID_REQUEST`, 5xx → `PROVIDER_ERROR`, timeout → `TIMEOUT`, network failure → `NETWORK_ERROR`. Error messages and `cause` SHALL NOT include the `api-key` or full request headers.

#### Scenario: Authentication failure is not retryable
- **WHEN** Azure responds with HTTP 401 or 403
- **THEN** the adapter SHALL throw an `SdkError` with code `AUTH_ERROR` and `retryable: false`, and the error text SHALL omit the API key
#### Scenario: Rate limiting is retryable
- **WHEN** Azure responds with HTTP 429 after retry exhaustion
- **THEN** the adapter SHALL throw an `SdkError` with code `RATE_LIMITED` and the default retryable flag for that code

#### Scenario: Provider server error is classified
- **WHEN** Azure responds with HTTP 5xx after retry exhaustion
- **THEN** the adapter SHALL throw an `SdkError` with code `PROVIDER_ERROR`

### Requirement: Shared transport applies timeout and limited retry
The concrete `Transport` implementation SHALL wrap `fetch` with an `AbortController` timeout and SHALL retry only `RetryPolicy.retryableStatusCodes` plus network/timeout failures up to `maxRetries`, then surface the final failure to the adapter. The transport SHALL NOT import `SdkError`.

#### Scenario: Retriable status is retried then surfaced
- **WHEN** the transport receives HTTP 429 and the retry policy permits retries
- **THEN** it SHALL retry up to `maxRetries` and, on exhaustion, throw a transport error carrying the final status for the adapter to classify

#### Scenario: Timeout aborts the request
- **WHEN** a request exceeds the configured timeout
- **THEN** the transport SHALL abort the request and throw a timeout-kind error for the adapter to classify as `TIMEOUT`

#### Scenario: Transport can be replaced in tests
- **WHEN** the Azure provider is constructed with a custom transport
- **THEN** the adapter SHALL use that transport for all requests without falling back to global `fetch`

### Requirement: Unsupported public parameters fail before network
The image generation request SHALL expose public parameters `prompt`, optional `n`, and optional `size`, plus an optional `providerOptions` namespace. Parameters not supported by the model capabilities or malformed values SHALL fail with `INVALID_REQUEST` before any transport call.

#### Scenario: Unsupported parameter is rejected pre-flight
- **WHEN** `generateImage` receives a public parameter the model capabilities do not support
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the transport

#### Scenario: Azure-native options stay namespaced
- **WHEN** Azure-specific fields are supplied under `providerOptions.azure`
- **THEN** they SHALL be forwarded into the Azure request body and SHALL not appear in the public parameter contract

