# examples-workspace Specification

## Purpose
TBD - created by archiving change sub-005-examples-playground. Update Purpose after archive.
## Requirements
### Requirement: Provider examples are runnable and minimal
The repository SHALL provide at least one runnable Node.js image-generation example for every first-party Provider supported by the current SDK workspace. Each example MUST load its documented environment configuration, construct the Provider through its public package API, call the unified image-generation API, and print a useful success or failure summary.

#### Scenario: Run an example with valid configuration
- **WHEN** a developer supplies the Provider variables documented by the example and runs its documented Bun command
- **THEN** the example invokes the unified SDK API with one conservative image request and reports the resulting image reference or stable error

#### Scenario: Run an example without configuration
- **WHEN** a required Provider variable is missing
- **THEN** the example exits without a Provider request and prints an actionable missing-configuration message that does not contain secrets

### Requirement: Examples SHALL avoid accidental high-cost behavior
Examples MUST use a single output and a documented conservative default request, and MUST NOT perform batch generation, automatic fallback, or hidden retries.

#### Scenario: Execute the default example request
- **WHEN** the developer runs an example without optional flags
- **THEN** it submits no more than one generation request with one output and no automatic Provider switch

