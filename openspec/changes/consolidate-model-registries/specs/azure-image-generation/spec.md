## MODIFIED Requirements

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
