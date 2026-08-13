## MODIFIED Requirements

### Requirement: The Playground exposes capability-aware generation controls

The Playground SHALL provide a top-level modality switcher with three tabs: image, video, and audio. Tab labels SHALL be rendered in the active locale where the app is internationalised (Chinese: 图像/视频/音频; English: Image/Video/Audio). The audio tab SHALL be visible but disabled with an explanatory "coming soon" tooltip (localised, e.g. "即将推出" / "Coming soon"); selecting an enabled tab SHALL fully reset the form state (provider, model, operation/scenario, prompt, all media inputs, all size/n/resolution/ratio/duration/audio_setting fields, advanced options, and result feed) so no field from the previous modality contaminates the new one. Within each modality, the form SHALL provide visible, keyboard-operable controls for Provider, model, operation, prompt, and generation parameters. The image workbench SHALL offer a generate/edit operation toggle (edit disabled for models without `supportsEdit`). Video models SHALL NOT use an operation enum: multi-scenario models (one model id serving several scenarios, e.g. MiniMax-H3) SHALL render a scenario selector (t2v/i2v/r2v), while flag-driven models (e.g. HappyHorse) SHALL derive their inputs from registry flags (`requiresFirstFrame` for i2v, `requiresInputVideo` for video-edit) without a selector. The form SHALL show only compatible models/fields or explicitly explain why an option is unavailable. This requirement applies to both the server-mediated playground (`apps/web`) and the BYO-key playground (`apps/site`); in the internationalised site app every user-facing label SHALL come from the active locale's translation resources (see the `site-i18n` capability).

#### Scenario: Switch modality resets the form

- **WHEN** the user fills the image form (prompt, size, n, advanced options) and then activates the video tab, then switches back to the image tab
- **THEN** all previously entered image-form fields SHALL be cleared; the form SHALL present a fresh default state with the first compatible model and its first supported `size` value

#### Scenario: Audio tab is visible but disabled

- **WHEN** the user opens the Playground
- **THEN** the top-level modality switcher SHALL show an audio tab; the tab SHALL be visibly disabled and pointer-events disabled; activating it SHALL produce no navigation, and a localised tooltip SHALL explain that audio is reserved

#### Scenario: Configure text-to-image

- **WHEN** the user opens the generation workspace
- **THEN** the form presents Provider/model choices, a required prompt, supported parameters, example prompt actions, and a primary Generate action

#### Scenario: Switch to image edit mode

- **WHEN** the user selects edit mode within the image modality
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

## ADDED Requirements

### Requirement: The form derives size, output count, and video parameters from the selected model

The form SHALL derive the options for the image `size`/`n` dropdowns and the video `resolution`/`ratio`/`duration` dropdowns from the selected model's declared capabilities (`supportedSizes`/`maxResolution`/`maxN` for image; the Provider registry's `supportedResolutions`/`supportedAspectRatios` for video) projected from the Provider registries. When the model accepts a closed `supportedSizes` set, the `size` dropdown SHALL list exactly those values, labelled by the raw value (no Provider-specific marketing labels). When the model accepts free-form pixel sizes within a `maxResolution`, the dropdown SHALL list pixel presets within the cap (e.g. `1024x1024`, `2048x2048`, `2048x1024`, `1024x2048`) and the validator SHALL enforce the cap. The `n` dropdown SHALL list `1..maxN` when `maxN` is defined, otherwise `1..4`. The default selected value for every model-derived dropdown SHALL be the first option of the derived list. Switching models SHALL re-derive the dropdowns and reset the selected values to the new first option. Video dropdowns follow the same registry-driven rule per Provider (Aliyun HappyHorse/Wan 3.0 and MiniMax-H3); MiniMax-specific scenario rules (ratio availability, 4-15s duration) are defined by the MiniMax scenario requirement above.

#### Scenario: Image size dropdown reflects model supportedSizes

- **WHEN** the user selects the Doubao Seedream 5.0 Pro model
- **THEN** the `size` dropdown SHALL contain only `1K` and `2K`, each labelled by its raw value (no Aliyun-style label such as `2K横图` SHALL leak), and the default selection SHALL be `1K`

#### Scenario: Image size dropdown reflects pixel maxResolution

- **WHEN** the user selects the Aliyun Qwen Image 2.0 Pro model (no `supportedSizes`, `maxResolution` 2048×2048)
- **THEN** the `size` dropdown SHALL list pixel presets within the 2048×2048 cap; the default selection SHALL be the first preset (e.g. `1024x1024`)

#### Scenario: Image n dropdown respects maxN

- **WHEN** the user selects the Aliyun Wan 2.7 Image Pro model (maxN 4) and then the Doubao Seedream 5.0 Pro model (maxN 1)
- **THEN** the `n` dropdown SHALL list `1..4` for the Wan model and `1` only for the Seedream model; switching models SHALL reset the selected `n` to the first allowed value

#### Scenario: Video resolution dropdown reflects model supportedResolutions

- **WHEN** the user selects the HappyHorse 1.0 Video Edit model
- **THEN** the `resolution` dropdown SHALL contain only `720P` and `1080P` (no `480P`); the `ratio` and `duration` controls SHALL be hidden; the `audio_setting` control SHALL be visible; the default resolution SHALL be `720P`

#### Scenario: Default first option when switching models

- **WHEN** the user is on the Azure `gpt-image-2` model with `size: "1536x1024"` and switches to the Seedream 5.0 Pro model
- **THEN** the `size` value SHALL reset to `1K` (the first option of the new model's `supportedSizes`); the previous `"1536x1024"` value SHALL NOT be carried over

### Requirement: The form exposes a collapsible Advanced Options section for provider-native options

The image workbench SHALL render a collapsed Advanced Options section below the basic parameters, titled per the active locale where the app is internationalised ("高级选项" / "Advanced options"). When expanded, the section SHALL render only the controls for `providerOptions.<namespace>` fields that the selected model's family supports: Azure `gpt-image-2` exposes `quality`, `output_format`, `output_compression` under `providerOptions.azure`; Aliyun Qwen-family models (including `qwen-image-3.0`) and Aliyun Wan 2.6 image models expose `negative_prompt`, `prompt_extend`, `watermark`, `seed` under `providerOptions.aliyun`; Aliyun Wan 2.7 image models expose `watermark`, `seed`, `thinking_mode` (boolean), `color_palette`, `enable_sequential`; Doubao Seedream 5.x models expose `watermark`, `output_format` (omitted on 4.x), `response_format`, `optimize_prompt_mode` under `providerOptions.seedream`. Fields that the selected model does not support SHALL NOT appear. The Advanced Options section SHALL start collapsed and SHALL NOT block submission when collapsed.

#### Scenario: Azure advanced options

- **WHEN** the user expands Advanced Options while Azure `gpt-image-2` is selected
- **THEN** the section SHALL show `quality`, `output_format`, `output_compression` controls; it SHALL NOT show any Aliyun or Seedream fields

#### Scenario: Seedream 4.x omits output_format

- **WHEN** the user expands Advanced Options while Doubao Seedream 4.5 is selected
- **THEN** the section SHALL show `watermark`, `response_format`, `optimize_prompt_mode` and SHALL NOT show `output_format`

#### Scenario: Collapsed Advanced Options does not block submission

- **WHEN** the user submits the form without expanding Advanced Options
- **THEN** the submission SHALL proceed and the server SHALL receive only the basic parameters (no provider-native fields)
