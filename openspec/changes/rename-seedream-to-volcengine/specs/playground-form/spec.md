## MODIFIED Requirements

### Requirement: The form exposes a collapsible Advanced Options section for provider-native options

The image workbench SHALL render a collapsed Advanced Options section below the basic parameters, titled per the active locale where the app is internationalised ("高级选项" / "Advanced options"). When expanded, the section SHALL render only the controls for `providerOptions.<namespace>` fields that the selected model's family supports: Azure `gpt-image-2` exposes `quality`, `output_format`, `output_compression` under `providerOptions.azure`; Aliyun Qwen-family models (including `qwen-image-3.0`) and Aliyun Wan 2.6 image models expose `negative_prompt`, `prompt_extend`, `watermark`, `seed` under `providerOptions.aliyun`; Aliyun Wan 2.7 image models expose `watermark`, `seed`, `thinking_mode` (boolean), `color_palette`, `enable_sequential`; Doubao Seedream 5.x models expose `watermark`, `output_format` (omitted on 4.x), `response_format`, `optimize_prompt_mode` under `providerOptions.volcengine`. Fields that the selected model does not support SHALL NOT appear. The Advanced Options section SHALL start collapsed and SHALL NOT block submission when collapsed.

#### Scenario: Azure advanced options

- **WHEN** the user expands Advanced Options while Azure `gpt-image-2` is selected
- **THEN** the section SHALL show `quality`, `output_format`, `output_compression` controls; it SHALL NOT show any Aliyun or Volcengine fields

#### Scenario: Doubao Seedream 4.x omits output_format

- **WHEN** the user expands Advanced Options while Doubao Seedream 4.5 is selected
- **THEN** the section SHALL show `watermark`, `response_format`, `optimize_prompt_mode` and SHALL NOT show `output_format`

#### Scenario: Collapsed Advanced Options does not block submission

- **WHEN** the user submits the form without expanding Advanced Options
- **THEN** the submission SHALL proceed and the server SHALL receive only the basic parameters (no provider-native fields)
