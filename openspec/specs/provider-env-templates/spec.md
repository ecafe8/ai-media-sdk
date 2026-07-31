# provider-env-templates Specification

## Purpose
TBD - created by archiving change sub-005-examples-playground. Update Purpose after archive.
## Requirements
### Requirement: Provider environment templates are safe and complete
Each first-party Provider example SHALL include a `.env.example` containing variable names, required/optional status, and placeholder descriptions only. Templates MUST NOT contain real API keys, tokens, or credentials.

#### Scenario: Copy a Provider environment template
- **WHEN** a developer opens a Provider `.env.example`
- **THEN** every required variable needed by the corresponding example is documented with a non-secret placeholder and no usable credential is present

#### Scenario: Inspect optional Provider configuration
- **WHEN** a Provider has a region, deployment, model, or endpoint option
- **THEN** the template labels the option as required or optional and explains its expected format

### Requirement: Configuration status is actionable
The examples and Playground documentation SHALL explain how missing or invalid variables affect availability and SHALL identify the server-only nature of Playground credentials.

#### Scenario: Provider is not configured
- **WHEN** a required variable is absent
- **THEN** the user sees a clear configuration action and the system does not attempt a network call

