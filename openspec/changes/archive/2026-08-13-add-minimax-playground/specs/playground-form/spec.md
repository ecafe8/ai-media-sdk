## ADDED Requirements

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
