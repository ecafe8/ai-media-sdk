## ADDED Requirements

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
