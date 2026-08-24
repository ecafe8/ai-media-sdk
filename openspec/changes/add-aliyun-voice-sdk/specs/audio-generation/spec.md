## Purpose

Provide a provider-independent synchronous audio generation contract so callers can synthesize speech with a selected voice without depending on Alibaba-specific request or response shapes.

## ADDED Requirements

### Requirement: Audio generation exposes a normalized synchronous contract

The SDK SHALL allow a caller to submit text, a voice identifier, and a bound audio model and SHALL return a generation result containing one or more normalized `AudioContent` values.

#### Scenario: TTS returns an audio URL
- **WHEN** a valid non-realtime TTS request completes with a provider audio URL
- **THEN** the SDK SHALL return the URL, MIME type when known, provider request ID, and provider/model identity in the normalized result

#### Scenario: TTS returns inline audio
- **WHEN** a provider returns Base64 audio data instead of a URL
- **THEN** the SDK SHALL expose the data as normalized audio content without requiring the caller to decode it first

### Requirement: Audio requests support provider-native options without polluting common fields

The SDK SHALL keep common audio inputs limited to text and voice identity; provider-specific synthesis options SHALL be carried under a provider namespace and SHALL be forwarded without renaming their documented semantics. The Alibaba contract SHALL distinguish Qwen-Audio/CosyVoice options from Qwen-TTS options and SHALL reject options unsupported by the selected model.

#### Scenario: Alibaba TTS options are forwarded
- **WHEN** a request supplies format, sample rate, volume, rate, pitch, language, or instruction options under the Alibaba namespace
- **THEN** the provider SHALL forward only options supported by the selected Alibaba model using the documented wire names

#### Scenario: Qwen-Audio options are distinguished from Qwen-TTS options
- **WHEN** a caller selects a Qwen-Audio/CosyVoice model
- **THEN** the SDK SHALL support the documented `language_hints`, SSML, word timestamp, seed, AIGC, hot-fix, and Markdown options only where the selected model supports them

#### Scenario: Qwen-TTS options are distinguished from Qwen-Audio options
- **WHEN** a caller selects `qwen3-tts-flash` or `qwen3-tts-instruct-flash`
- **THEN** the SDK SHALL support `language_type`, `instructions`, and `optimize_instructions` according to the selected model and SHALL reject incompatible Qwen-Audio-only fields

#### Scenario: Invalid public audio input is rejected before transport
- **WHEN** text or voice is empty, or a provider-native option is outside the selected model's documented range
- **THEN** the SDK SHALL raise `INVALID_REQUEST` and SHALL not invoke the transport

### Requirement: Audio model capabilities are discoverable and type-safe

The SDK SHALL represent audio models as audio-bound model instances with capability metadata identifying whether synchronous generation is supported; image or video model instances SHALL NOT be accepted by audio generation APIs.

#### Scenario: Audio API rejects a non-audio model
- **WHEN** a caller passes an image or video model instance to audio generation
- **THEN** the SDK SHALL reject the request with `INVALID_REQUEST` before transport dispatch

#### Scenario: Alibaba audio models are listed
- **WHEN** a caller enumerates the configured Alibaba provider models
- **THEN** the list SHALL include supported TTS model IDs with modality `audio` and their generation capabilities

#### Scenario: Supported model matrix identifies protocol differences
- **WHEN** a caller inspects Alibaba audio model metadata
- **THEN** the metadata SHALL identify the endpoint/protocol family and supported options for `qwen-audio-3.0-tts-plus`, `qwen-audio-3.0-tts-flash`, `cosyvoice-v3.5-plus`, `cosyvoice-v3.5-flash`, `cosyvoice-v3-plus`, `cosyvoice-v3-flash`, `cosyvoice-v2`, `qwen3-tts-flash`, and `qwen3-tts-instruct-flash`
