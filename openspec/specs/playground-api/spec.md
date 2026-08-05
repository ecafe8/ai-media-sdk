# playground-api Specification

## Purpose
TBD - created by archiving change sub-005-examples-playground. Update Purpose after archive.
## Requirements
### Requirement: Playground requests are server-mediated
The Playground SHALL accept only non-secret generation inputs through a server-side JSON endpoint. Provider credentials MUST be read from server environment configuration and MUST NOT be accepted from, emitted to, or bundled into the browser client.

#### Scenario: Submit a valid text-to-image request
- **WHEN** the client posts a valid provider, model, mode, prompt, and public parameters
- **THEN** the server resolves credentials from its environment, calls the unified SDK, and returns a stable result envelope

#### Scenario: Client submits a credential field
- **WHEN** a request includes an API key, authorization header value, or equivalent credential field
- **THEN** the server rejects or ignores the field and does not include it in logs or the response

### Requirement: The route validates capability-aware inputs
The server SHALL reject missing prompts, unknown Provider/model combinations, unavailable configuration, unsupported edit mode, invalid reference-image URLs, and invalid public parameters before Provider dispatch.

#### Scenario: Select a model that does not support editing
- **WHEN** an edit request names a non-editable model
- **THEN** the server returns a stable unsupported-capability error and makes no Provider call

#### Scenario: Submit an invalid request
- **WHEN** the prompt is empty or a reference image is malformed
- **THEN** the server returns a safe client error with an actionable message and no Provider request

### Requirement: Playground errors are sanitized
The server SHALL map known configuration, validation, timeout, network, and Provider failures to stable error codes/messages without exposing credentials, stack traces, raw authorization data, or complete Provider response bodies.

#### Scenario: Provider call fails
- **WHEN** the SDK returns a known or unknown Provider error
- **THEN** the response contains a stable safe error envelope and no secret or internal stack information

### Requirement: Playground model list derives from Provider registries

The Playground model selection surface (`PLAYGROUND_MODELS` and its `getPlaygroundModel`/`getClientPlaygroundModels` accessors) SHALL derive model ids, modalities, and capabilities from the Provider packages' exported **full** in-package registries (`ALIYUN_MODEL_REGISTRY`, `SEEDREAM_MODEL_REGISTRY`, `AZURE_MODEL_REGISTRY`) as the single source of truth, preserving Provider-specific fields the Playground needs (Aliyun video `requiresFirstFrame`/`requiresInputVideo`/`maxReferenceImages`, Seedream `capabilities.maxEditImages`). UI-only display text (labels, recommendations) MAY live in a sidecar map keyed by `${provider}:${id}`. The Playground SHALL NOT hand-maintain a duplicate model id or capability list that can drift from the SDK registries. The common `*ModelRegistry` projection consts are a separate SDK-consumer surface and SHALL NOT be the Playground's derivation source (they omit the Provider-specific fields the UI requires).

#### Scenario: Model ids match the SDK full registries

- **WHEN** the Playground builds its model list
- **THEN** every entry's `id`, `provider`, `modality`, `supportsGenerate`, `supportsEdit`, and `supportsAsync` SHALL be equal to the corresponding full registry entry, and SHALL NOT include ids absent from all registries

#### Scenario: Drifted placeholder models are removed

- **WHEN** the Playground model list is built
- **THEN** entries that previously existed only as hardcoded placeholders (`z-image-turbo`, the duplicate `wan2.7-t2v-2026-06-12`, `wan2.7-r2v-2026-06-12`) SHALL NOT appear, because they are absent from the Provider registries

#### Scenario: Alias model ids are both listed

- **WHEN** a Provider registry contains an alias pair mapping two ids to the same entry (e.g. Seedream `doubao-seedream-5-0-260128` ↔ `doubao-seedream-5-0-lite-260128`)
- **THEN** the Playground SHALL list both ids as separate entries (both are valid call targets) rather than collapsing them into one

#### Scenario: UI display text is sourced from a sidecar

- **WHEN** a model entry needs a human-readable label or recommendation
- **THEN** the Playground SHALL look it up from a sidecar constants map keyed by `${provider}:${id}`, falling back to the model id when no sidecar entry exists, and SHALL NOT duplicate capability data in that sidecar

