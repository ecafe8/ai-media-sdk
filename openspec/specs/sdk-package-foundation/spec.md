# sdk-package-foundation Specification

## Purpose
TBD - created by archiving change phase-0-sdk-foundation. Update Purpose after archive.
## Requirements
### Requirement: Core package exposes a modality-neutral alpha contract
The `@ai-media/sdk` package SHALL expose TypeScript contracts for Provider/model identity, capabilities, transport, adapter requests/results, `GenerationResult<TContent>`, `TaskHandle<TContent>`, retry policy, and classified SDK errors. Image specialization SHALL use the array content form so a single generation result can carry multiple images.

#### Scenario: Core package resolves through the workspace export
- **WHEN** a workspace consumer imports `@ai-media/sdk`
- **THEN** the import resolves to the package source entry without requiring an external runtime SDK

#### Scenario: Image content specializes the generic result contract
- **WHEN** an image API type is declared in the core package
- **THEN** it uses `GenerationResult<ImageContent[]>` or `TaskHandle<ImageContent[]>` for the image modality rather than a separate non-generic task/result model, keeping `GenerationResult<TContent>` generic for other modalities

### Requirement: Core package root exports are explicit
The `@ai-media/sdk` root entry SHALL export the supported Phase 0 public contracts and image stubs; consumers SHALL NOT need to import implementation files through `src` paths.

#### Scenario: Consumer imports supported root API
- **WHEN** a consumer imports `generateImage`, `editImage`, `ImageContent`, `GenerationResult`, `TaskHandle`, or `SdkError` from `@ai-media/sdk`
- **THEN** the symbols SHALL resolve from the package root export

#### Scenario: Internal source paths are not required
- **WHEN** a consumer uses the Phase 0 API
- **THEN** the consumer SHALL not need to import from `@ai-media/sdk/src/*`

### Requirement: Runtime core remains Node-oriented
The core package runtime TypeScript configuration SHALL use the shared Node library configuration without DOM libraries or Bun-only runtime types.

#### Scenario: Browser-only globals are unavailable to runtime source
- **WHEN** core runtime source references a browser global such as `window` or `document`
- **THEN** the package typecheck SHALL reject the reference

#### Scenario: Bun test types remain isolated
- **WHEN** core tests import from `bun:test`
- **THEN** the test tsconfig SHALL provide Bun types without adding Bun runtime types to the production tsconfig

### Requirement: Core package has a passing Bun smoke test
The core package SHALL contain at least one `bun:test` test that validates a stable error or contract behavior without network access.

#### Scenario: Core smoke test runs locally
- **WHEN** the root test task runs
- **THEN** the core smoke test SHALL pass without Provider credentials or external network access

