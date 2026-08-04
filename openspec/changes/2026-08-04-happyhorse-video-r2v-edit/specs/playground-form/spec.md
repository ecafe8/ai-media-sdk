## ADDED Requirements

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
