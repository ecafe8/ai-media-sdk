## ADDED Requirements

### Requirement: The Playground exposes capability-aware generation controls
The Playground SHALL provide visible, keyboard-operable controls for Provider, model, generation/edit mode, prompt, and generation parameters. It SHALL show only compatible models/fields or explicitly explain why an option is unavailable.

#### Scenario: Configure text-to-image
- **WHEN** the user opens the generation workspace
- **THEN** the form presents Provider/model choices, a required prompt, supported parameters, example prompt actions, and a primary Generate action

#### Scenario: Switch to image edit mode
- **WHEN** the user selects edit mode
- **THEN** the form exposes the reference-image input only for edit-capable models and displays the selected model's input limits

### Requirement: The form prevents invalid submission
The form SHALL require a non-empty prompt, validate reference-image input and supported parameters, disable duplicate submission while a request is active, and preserve user input after failure.

#### Scenario: Submit with an empty prompt
- **WHEN** the user activates Generate without a prompt
- **THEN** the form shows an associated validation message and does not call the server route

#### Scenario: Generate while a request is active
- **WHEN** a request is submitting or processing
- **THEN** the primary action is disabled or otherwise prevents duplicate generation and communicates the current status in text

### Requirement: The form is responsive and accessible
The Playground SHALL use a two-pane desktop layout and a stacked narrow-screen layout without horizontal overflow. Controls MUST have visible labels, focus states, keyboard operation, and status/error associations.

#### Scenario: View the Playground on a narrow screen
- **WHEN** the viewport is narrower than the desktop breakpoint
- **THEN** controls appear before results in one column and the primary action remains usable without horizontal scrolling
