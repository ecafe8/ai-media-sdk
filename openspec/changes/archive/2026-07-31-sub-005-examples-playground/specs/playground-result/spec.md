## ADDED Requirements

### Requirement: The Playground renders the complete request lifecycle
The UI SHALL distinguish ready/empty, submitting, processing, succeeded, failed, unconfigured, and unsupported states using text and accessible status semantics, not color alone.

#### Scenario: Request is processing
- **WHEN** the server or SDK reports an in-progress task
- **THEN** the result area shows the current Provider/model and a processing indicator while preventing duplicate submission

#### Scenario: Request succeeds
- **WHEN** the server returns image references
- **THEN** the result area renders preview cards with alternative text and displays available URL, MIME, dimensions, Provider, model, and non-sensitive metadata

#### Scenario: Request fails
- **WHEN** the server returns a safe error envelope
- **THEN** the result area explains the failure, offers a retry path, preserves the form input, and does not show raw Provider response data

### Requirement: Results are temporary and non-persistent
The Playground SHALL display returned remote URLs or temporary previews without writing prompts, images, tasks, or results to durable storage or promising long-term availability.

#### Scenario: Refresh or leave the page
- **WHEN** the user refreshes the page or leaves the Playground
- **THEN** the system does not claim to restore a history or durable result gallery

### Requirement: Empty and unavailable states are actionable
The UI SHALL explain what the user can do when no result exists, a Provider is unconfigured, or a selected capability is unsupported.

#### Scenario: No Provider is configured
- **WHEN** the configuration registry reports no usable Provider
- **THEN** the Generate action is unavailable and the UI links or points to the relevant environment-template instructions
