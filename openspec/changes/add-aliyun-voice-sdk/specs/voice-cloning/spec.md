## Purpose

Provide an explicit lifecycle API for creating and managing persistent cloned voices from reference audio while hiding Alibaba's model-specific actions and identifier field names.

## ADDED Requirements

### Requirement: Voice cloning exposes a model-aware resource lifecycle

The SDK SHALL expose create, list, get, update, and delete operations for cloned voices, with update available only for cloning protocols that support it.

#### Scenario: Create a Qwen-Audio cloned voice
- **WHEN** a caller supplies a public audio URL, target model, valid name prefix, and optional language hints
- **THEN** the SDK SHALL create one cloned voice and return its normalized identifier, target model, request ID, and provider metadata

#### Scenario: Create a Qwen-TTS cloned voice
- **WHEN** a caller supplies audio as a supported public URL or supported audio Data URL, target model, preferred name, and optional language/text
- **THEN** the SDK SHALL use the Qwen-TTS cloning action and normalize the returned `voice` field as the voice identifier

#### Scenario: Qwen-TTS clone validates preferred name and audio input
- **WHEN** a Qwen-TTS clone uses a preferred name outside the 16-character alphanumeric/underscore rule or an unsupported audio MIME Data URL
- **THEN** the SDK SHALL raise `INVALID_REQUEST` before transport dispatch

#### Scenario: List cloned voices
- **WHEN** a caller requests cloned voices with optional prefix and pagination filters
- **THEN** the SDK SHALL return normalized voice records and pagination metadata when the provider supplies it

#### Scenario: Query a cloned voice
- **WHEN** a caller requests a supported Qwen-Audio voice by identifier
- **THEN** the SDK SHALL return its status, target model, timestamps, and resource link when provided

#### Scenario: Update a cloned voice
- **WHEN** a caller updates a supported Qwen-Audio voice with a new public audio URL
- **THEN** the SDK SHALL submit the update action and return the normalized operation result

#### Scenario: Delete a cloned voice
- **WHEN** a caller deletes a cloned voice using the identifier form required by its protocol
- **THEN** the SDK SHALL submit the correct provider action and return the deleted identifier when available

### Requirement: Voice cloning validates protocol-specific inputs before transport

The SDK SHALL validate required fields, naming rules, supported audio input forms, language values, text length, and operation/model compatibility before dispatching a request. Qwen-Audio/CosyVoice cloning SHALL use `prefix` with alphanumeric characters and at most ten characters, `language_hints` limited to `zh` or `en`, and a public audio URL. Qwen-TTS cloning SHALL use `preferred_name` with alphanumeric characters or underscores and at most sixteen characters, `language` from its documented language set, and an audio URL or Data URL limited to WAV, MPEG, or MP4.

#### Scenario: Invalid clone prefix is rejected
- **WHEN** a Qwen-Audio prefix contains unsupported characters or exceeds ten characters
- **THEN** the SDK SHALL raise `INVALID_REQUEST` without invoking the transport

#### Scenario: Clone language values are model-specific
- **WHEN** a caller supplies an unsupported `language_hints` or `language` value for the selected clone protocol
- **THEN** the SDK SHALL raise `INVALID_REQUEST` without invoking the transport

#### Scenario: Clone source audio form is validated
- **WHEN** a Qwen-TTS clone receives a non-public URL or a Data URL with an unsupported audio MIME type
- **THEN** the SDK SHALL raise `INVALID_REQUEST` without invoking the transport

#### Scenario: Unsupported clone operation is rejected
- **WHEN** a caller requests an operation not supported by the selected cloning protocol
- **THEN** the SDK SHALL raise `INVALID_REQUEST` with a message identifying the unsupported operation

### Requirement: Voice cloning does not expose provider credentials or unstable wire names as the primary contract

Normalized voice records SHALL use stable SDK fields such as `id`, `targetModel`, `createdAt`, `updatedAt`, `status`, and `resourceLink`; provider-specific fields MAY remain available through `raw` metadata.

#### Scenario: Provider identifier fields are normalized
- **WHEN** Alibaba returns either `voice_id` or `voice`
- **THEN** the SDK SHALL expose the value as the normalized voice `id` and preserve the provider response as optional raw metadata

### Requirement: Voice cloning distinguishes resource model from TTS target model

The SDK SHALL record both the cloning protocol/model and the target synthesis model. It SHALL validate that the target model belongs to the supported voice-cloning target set and SHALL not assume that every TTS model can consume every cloned voice.

#### Scenario: Cloning target model is preserved
- **WHEN** a voice is created with a target model
- **THEN** the normalized voice profile SHALL expose that target model and subsequent TTS documentation/API examples SHALL use the same model for the voice

#### Scenario: Unsupported cloning target is rejected
- **WHEN** a caller uses a target model not supported by the selected cloning protocol
- **THEN** the SDK SHALL raise `INVALID_REQUEST` before transport dispatch
