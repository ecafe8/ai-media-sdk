## Purpose

Provide an explicit lifecycle API for generating persistent voices from text descriptions, including the preview audio returned during creation, without conflating designed voices with audio-sample cloning.

## ADDED Requirements

### Requirement: Voice design exposes a separate model-aware resource lifecycle

The SDK SHALL expose create, list, get, and delete operations for designed voices and SHALL NOT expose update for protocols where Alibaba does not support updating a designed voice.

#### Scenario: Create a Qwen-Audio designed voice
- **WHEN** a caller supplies a target model, voice description, preview text, valid prefix, and optional language hints or preview audio settings
- **THEN** the SDK SHALL create one designed voice and return its normalized voice identity plus Base64 preview audio metadata

#### Scenario: Create a Qwen designed voice
- **WHEN** a caller supplies a target model, voice description, preview text, preferred name, and optional language or preview audio settings
- **THEN** the SDK SHALL use the Qwen voice-design action and normalize the returned `voice` field

#### Scenario: List designed voices
- **WHEN** a caller lists designed voices with optional pagination
- **THEN** the SDK SHALL return normalized records containing available target model, language, description, preview text, status, and timestamps

#### Scenario: Query a designed voice
- **WHEN** a caller queries a designed voice using the identifier form required by its protocol
- **THEN** the SDK SHALL return the normalized voice record and provider request ID

#### Scenario: Delete a designed voice
- **WHEN** a caller deletes a designed voice
- **THEN** the SDK SHALL submit the correct provider action and return the deleted identifier when available

### Requirement: Voice design validates description, preview, naming, language, and preview audio settings

The SDK SHALL validate model-specific text lengths, supported language values, naming rules, sample rates, response formats, and required fields before network dispatch. Qwen-Audio/CosyVoice SHALL limit `voice_prompt` to 500 characters, require `preview_text` between 15 and 200 characters, accept only `zh` or `en` language hints, and accept sample rates 16000, 24000, or 48000 with `pcm`, `wav`, or `mp3`. Qwen voice design SHALL limit `voice_prompt` to 2048 characters and `preview_text` to 1024 characters, use its documented ten-language set, and accept sample rates 8000, 16000, 24000, or 48000 with `pcm`, `wav`, `mp3`, or `opus`.

#### Scenario: Invalid preview text is rejected
- **WHEN** Qwen-Audio voice design receives preview text shorter than fifteen characters or longer than two hundred characters
- **THEN** the SDK SHALL raise `INVALID_REQUEST` without invoking the transport

#### Scenario: Design text limits are model-specific
- **WHEN** a voice prompt exceeds 500 characters for Qwen-Audio/CosyVoice or 2048 characters for Qwen, or preview text exceeds the selected model's documented maximum
- **THEN** the SDK SHALL raise `INVALID_REQUEST` without invoking the transport

#### Scenario: Invalid design language is rejected
- **WHEN** a voice design request supplies a language not supported by the selected model
- **THEN** the SDK SHALL raise `INVALID_REQUEST` before transport dispatch

#### Scenario: Preview audio settings are model-specific
- **WHEN** a caller supplies an unsupported sample rate or response format for the selected voice-design model
- **THEN** the SDK SHALL raise `INVALID_REQUEST` before transport dispatch

#### Scenario: Voice prompt and preview text limits are enforced
- **WHEN** a design request exceeds the selected model's voice-prompt or preview-text limit
- **THEN** the SDK SHALL raise `INVALID_REQUEST` without invoking the transport

#### Scenario: Unsupported update is unavailable
- **WHEN** a caller attempts to update a designed voice
- **THEN** the SDK surface SHALL reject the operation as unsupported rather than sending a cloning update action

### Requirement: Voice design preview audio is normalized as audio content

The result of voice design creation SHALL expose preview audio as normalized audio content with Base64 data, sample rate, response format, and an appropriate MIME type when derivable.

#### Scenario: Preview audio is returned with the created voice
- **WHEN** Alibaba returns `preview_audio.data`, `sample_rate`, and `response_format`
- **THEN** the SDK SHALL return the created voice and preview audio together without discarding the inline audio data

### Requirement: Voice design distinguishes resource model from TTS target model

The SDK SHALL record the design protocol/model separately from the target synthesis model and SHALL validate target-model compatibility before creating the designed voice.

#### Scenario: Designed voice target model is preserved
- **WHEN** a caller creates a designed voice for a target TTS model
- **THEN** the normalized profile SHALL expose the same target model and the preview result SHALL retain the provider request identity

#### Scenario: Unsupported design target is rejected
- **WHEN** a caller supplies a target model not supported by the selected design protocol
- **THEN** the SDK SHALL raise `INVALID_REQUEST` without invoking the transport
