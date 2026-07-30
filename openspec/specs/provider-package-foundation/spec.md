# provider-package-foundation Specification

## Purpose
TBD - created by archiving change phase-0-sdk-foundation. Update Purpose after archive.
## Requirements
### Requirement: Provider packages are independently addressable
The repository SHALL provide independent workspace package boundaries for `@ai-media/provider-azure-openai` and `@ai-media/provider-aliyun-bailian`, and each Provider package SHALL depend on `@ai-media/sdk` through a workspace dependency.

#### Scenario: Azure Provider package resolves independently
- **WHEN** a consumer imports `@ai-media/provider-azure-openai`
- **THEN** the package SHALL resolve its source entry and its core package dependency without requiring the Alibaba package

#### Scenario: Alibaba Provider package resolves independently
- **WHEN** a consumer imports `@ai-media/provider-aliyun-bailian`
- **THEN** the package SHALL resolve its source entry and its core package dependency without requiring the Azure package

### Requirement: Provider runtime skeletons do not call external APIs
The Phase 0 Provider package skeletons SHALL expose typed factory/model boundaries but SHALL NOT perform external HTTP calls or require Provider SDK runtime dependencies.

#### Scenario: Provider factory is used before contract discovery
- **WHEN** a Phase 0 Provider factory or adapter stub is invoked
- **THEN** it SHALL fail explicitly as not implemented or return a local typed model placeholder, and SHALL not read credentials or send a request

#### Scenario: Provider stub does not invoke injected transport
- **WHEN** a Provider smoke test invokes a Phase 0 factory or adapter stub with a counting fetch/transport
- **THEN** the transport call count SHALL remain zero

#### Scenario: Provider dependencies remain minimal
- **WHEN** workspace dependency metadata is inspected
- **THEN** Azure and Alibaba Provider packages SHALL depend on the core package and development tooling only, with no `openai` or DashScope runtime SDK

### Requirement: Provider packages use the Node library and base lint configurations
Each Phase 0 Provider package SHALL use the shared Node library TypeScript configuration and the non-React shared ESLint base configuration.

#### Scenario: Provider package typechecks as Node code
- **WHEN** a Provider package typecheck runs
- **THEN** it SHALL use Node runtime types and SHALL not require DOM or React types

### Requirement: Provider factory configuration boundaries are typed
Each Provider package SHALL define a typed configuration boundary without reading credentials or making network calls in Phase 0. Azure configuration SHALL include API key, endpoint, and API version; Alibaba configuration SHALL include API key and an optional base URL.

#### Scenario: Azure configuration shape is explicit
- **WHEN** a consumer constructs the Azure Provider configuration
- **THEN** TypeScript SHALL require `apiKey`, `endpoint`, and `apiVersion` fields

#### Scenario: Alibaba configuration shape is explicit
- **WHEN** a consumer constructs the Alibaba Provider configuration
- **THEN** TypeScript SHALL require `apiKey` and SHALL allow an optional `baseUrl`

### Requirement: Providers use the shared transport boundary
Provider adapter boundaries SHALL accept or construct the core transport abstraction and SHALL not call global `fetch` directly from adapter logic.

#### Scenario: Provider transport can be replaced in tests
- **WHEN** a Provider is constructed with a custom transport
- **THEN** the adapter boundary SHALL retain that transport for future requests without replacing it with global `fetch`

