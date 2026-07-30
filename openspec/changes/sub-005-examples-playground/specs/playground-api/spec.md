## ADDED Requirements

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
