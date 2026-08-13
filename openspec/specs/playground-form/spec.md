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

### Requirement: Playground exposes MiniMax H3 video scenarios

The Playground SHALL expose the MiniMax-H3 model through a scenario selector because one model id serves text-to-video, image-to-video, and reference-to-video. The selector SHALL offer 文生视频, 图生视频, and 参考生视频, and the form SHALL show only the inputs and parameter rules of the selected scenario. Models whose scenario is fixed by registry flags (HappyHorse) SHALL NOT show the selector and SHALL keep their current behavior.

Scenario parameter rules: text-to-video SHALL require a non-empty prompt and a concrete aspect ratio (`adaptive` SHALL NOT be offered); image-to-video SHALL require a first-frame URL, SHALL offer an optional last-frame URL, and SHALL hide the ratio control (the adapter forces `adaptive`); reference-to-video SHALL require at least one reference image URL and SHALL offer optional reference video/audio URL lists plus an optional ratio defaulting to `adaptive`. Duration options for MiniMax models SHALL be integers from 4 to 15 seconds; the resolution control SHALL offer the registry allowlist (`768P`/`2K`).

#### Scenario: Selecting the MiniMax model shows the scenario selector

- **WHEN** the user selects the configured `MiniMax-H3` model in the video workbench
- **THEN** the form SHALL present the scenario selector with 文生视频 / 图生视频 / 参考生视频 and default to 文生视频

#### Scenario: Text-to-video scenario requires a concrete ratio

- **WHEN** the user selects 文生视频 for MiniMax-H3
- **THEN** the form SHALL show a ratio control without the `adaptive` option and SHALL submit the selected ratio

#### Scenario: Image-to-video scenario exposes first and optional last frame

- **WHEN** the user selects 图生视频 and provides a valid first-frame URL
- **THEN** the form SHALL submit `firstFrame` (and `lastFrame` when filled), SHALL hide the ratio control, and SHALL NOT send reference media

#### Scenario: Reference-to-video scenario requires reference images

- **WHEN** the user selects 参考生视频 without any reference image URL
- **THEN** the form SHALL show an associated validation message and SHALL not call the server route

#### Scenario: Scenario inputs stay mutually exclusive

- **WHEN** the user switches scenarios before submitting
- **THEN** the form SHALL submit only the inputs of the active scenario; inputs from other scenarios SHALL NOT be sent

#### Scenario: MiniMax duration options respect the 4-15 second range

- **WHEN** the user opens the duration control for MiniMax-H3
- **THEN** every offered duration SHALL be an integer between 4 and 15 seconds, and HappyHorse models SHALL keep their existing duration options

