## MODIFIED Requirements

### Requirement: Core package exposes a modality-neutral alpha contract
The `@ai-media/sdk` package SHALL expose TypeScript contracts for Provider/model identity, capabilities, transport, adapter requests/results, `GenerationResult<TContent>`, `TaskHandle<TContent>`, retry policy, and classified SDK errors. Image specialization SHALL use the array content form so a single generation result can carry multiple images.

#### Scenario: Core package resolves through the workspace export
- **WHEN** a workspace consumer imports `@ai-media/sdk`
- **THEN** the import resolves to the package source entry without requiring an external runtime SDK

#### Scenario: Image content specializes the generic result contract
- **WHEN** an image API type is declared in the core package
- **THEN** it uses `GenerationResult<ImageContent[]>` or `TaskHandle<ImageContent[]>` for the image modality rather than a separate non-generic task/result model, keeping `GenerationResult<TContent>` generic for other modalities

## REMOVED Requirements

### Requirement: Image API stubs preserve the planned public boundary
**Reason**: Phase 1 retires the `generateImage` `NOT_IMPLEMENTED` stub; generation now dispatches through a provider-bound model instance (see the `azure-image-generation` capability). `editImage` remains a `NOT_IMPLEMENTED` stub in this slice.
**Migration**: Call `generateImage` with a request whose `model` is an image model instance produced by `provider.image(modelOrDeployment)`. Continue to expect `editImage` to throw `NOT_IMPLEMENTED` until a later slice implements image editing.
