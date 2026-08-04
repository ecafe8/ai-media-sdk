# playground-form Specification

## Purpose
TBD - created by archiving change sub-005-examples-playground. Update Purpose after archive.
## Requirements
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

### Requirement: Playground exposes extended HappyHorse video modes

The Playground SHALL expose configured HappyHorse r2v and video-edit models with controls for their required media: one to nine reference image URLs for r2v, and one source video URL plus zero to five reference image URLs for video-edit. It SHALL communicate unsupported parameter combinations, including the absence of `ratio` and `duration` for video-edit.

#### Scenario: Configure r2v

- **WHEN** the user selects a configured HappyHorse r2v model
- **THEN** the form SHALL expose ordered reference image inputs and allow submission only when at least one valid reference image is present

#### Scenario: Configure video-edit

- **WHEN** the user selects a configured HappyHorse video-edit model
- **THEN** the form SHALL expose a source video URL, optional reference image inputs, and video-edit-compatible parameters

#### Scenario: Invalid extended video input is blocked

- **WHEN** the user submits r2v without references or video-edit without a source video
- **THEN** the form SHALL show an associated validation message and SHALL not call the server route

### Requirement: Playground presents extended video results and errors

The Playground SHALL present r2v/video-edit task status (processing, succeeded, failed), render the returned `VideoContent[]` (video playback plus download link), and surface sanitized Provider errors without leaking credentials or internal stack traces. During a running task, the primary action SHALL be disabled to prevent duplicate submission.

#### Scenario: Render a successful video-edit result

- **WHEN** a video-edit task succeeds and returns a `VideoContent` URL
- **THEN** the Playground SHALL render the video and expose a download link, and the processing state SHALL clear

#### Scenario: Surface a sanitized Provider error

- **WHEN** a video-edit task fails with a Provider error
- **THEN** the Playground SHALL show a stable error message and SHALL not expose API keys, full request headers, or internal stack traces

#### Scenario: Prevent duplicate submission while processing

- **WHEN** an r2v or video-edit task is submitting or processing
- **THEN** the primary action SHALL be disabled or otherwise prevent duplicate generation and communicate the current status in text

