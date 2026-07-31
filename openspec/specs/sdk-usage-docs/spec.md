# sdk-usage-docs Specification

## Purpose
TBD - created by archiving change sub-005-examples-playground. Update Purpose after archive.
## Requirements
### Requirement: SDK usage and configuration are discoverable
The repository SHALL document how to install/run the examples, copy each `.env.example`, construct each supported Provider, invoke the unified image API, and interpret returned image references and errors.

#### Scenario: A new developer follows the example documentation
- **WHEN** the developer starts from the repository documentation
- **THEN** they can identify a Provider example, required environment variables, the run command, and the expected success/error output without reading implementation internals

### Requirement: Provider capability differences are documented
Documentation and Playground model choices SHALL identify supported generation/edit capabilities and Alibaba recommended model use cases. `z-image-turbo` MUST be described as generation-only and MUST NOT be presented as an editable model.

#### Scenario: Choose an Alibaba model for editing
- **WHEN** a developer reads the model capability guidance or selects edit mode
- **THEN** only edit-capable models are offered and the generation-only limitation of `z-image-turbo` is clear

### Requirement: Documentation states the security boundary
Documentation SHALL state that Playground API keys are server-side environment configuration, the browser never receives Provider credentials, the Playground is controlled/development-only, and results are not durably stored.

#### Scenario: Deploy the Playground for a controlled test
- **WHEN** a developer reads the deployment/configuration guidance
- **THEN** the guidance identifies the controlled-use assumption and does not imply public multi-tenant or persistent service behavior

