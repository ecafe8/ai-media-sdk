## Purpose

Provides a safe, discoverable Playground workflow for testing Alibaba CosyVoice audio generation with ordinary text, SSML controls, and Chinese LaTeX formula speech.

## ADDED Requirements

### Requirement: Playground exposes supported audio models
The server-proxied Playground SHALL expose supported Alibaba audio models as audio models, separate from image and video models, and SHALL not expose an audio model through an image or video form.

#### Scenario: Audio model is selected
- **WHEN** a user selects a supported Alibaba CosyVoice model
- **THEN** the Playground opens the audio workbench and does not show image or video-only controls

#### Scenario: Unsupported provider is selected for audio
- **WHEN** a user requests audio generation with a provider or model that does not support the audio modality
- **THEN** the request is rejected with a stable validation error before provider dispatch

### Requirement: User can submit an audio generation request
The Playground SHALL allow a user to provide non-empty text and voice values and SHALL submit them to the selected Alibaba audio model using the existing provider credentials and audio generation contract.

#### Scenario: Valid audio request
- **WHEN** the user submits text and a voice for a supported CosyVoice model
- **THEN** the server generates audio and returns a successful audio response

#### Scenario: Missing required audio input
- **WHEN** the user submits an empty text or voice
- **THEN** the Playground rejects the request with a validation error and does not call the provider

### Requirement: Playground supports CosyVoice controls
The audio workbench SHALL expose controls only when supported by the selected CosyVoice model. The first slice SHALL support directly playable `mp3` and `wav` output, supported sample rates, rate, pitch, volume, and SSML options under the Alibaba provider namespace, and SHALL omit unset optional values from the request. PCM or other non-playable formats MUST NOT be presented as directly playable output.

#### Scenario: SSML is enabled
- **WHEN** the user enables SSML and submits text containing valid SSML
- **THEN** the request sends `enable_ssml` as enabled and preserves the text exactly as entered

#### Scenario: SSML is disabled
- **WHEN** the user submits ordinary text with SSML disabled
- **THEN** the request sends the text unchanged without enabling SSML

#### Scenario: Unsupported control is selected
- **WHEN** a user selects a format, sample rate, or SSML option not supported by the selected model
- **THEN** the Playground rejects the request before provider dispatch with a stable validation error

### Requirement: LaTeX text is passed through unchanged
The Playground SHALL accept Chinese text containing supported LaTeX delimiters and SHALL preserve formula characters, backslashes, and delimiters when forwarding the request; it SHALL not parse, rewrite, or render the formula.

#### Scenario: Formula text is submitted
- **WHEN** the user submits text containing a formula such as `$x = \\frac{-b}{2a}$`
- **THEN** the provider receives the same formula content and the response is handled as audio generation

### Requirement: Audio results are playable and downloadable
The Playground SHALL render successful URL or Base64 audio results in an accessible audio player, derive a usable MIME type when metadata is available, and provide a download action when the result can be downloaded.

#### Scenario: URL audio result
- **WHEN** the provider returns an audio URL
- **THEN** the result feed renders an audio player with controls and a download link

#### Scenario: Base64 audio result
- **WHEN** the provider returns Base64 audio and a format or MIME type
- **THEN** the result feed builds a data URL and renders it in an audio player

### Requirement: Provider failures are safe and actionable
The Playground SHALL map validation, authentication, timeout, network, and provider failures to stable user-facing errors without exposing credentials, request headers, or internal stack traces.

#### Scenario: Provider request fails
- **WHEN** Alibaba rejects or cannot complete an audio request
- **THEN** the Playground shows a sanitized error and retains no secret provider data in the response

### Requirement: Audio requests are bounded and protected
The server-proxied audio endpoint SHALL enforce a maximum 64 KiB JSON request body, a maximum 10,000-character text value, the configured provider timeout, and a limit of five audio generations per client per minute through a shared rate-limit mechanism before dispatch. If the shared rate-limit mechanism is unavailable, the audio feature MUST remain disabled. It MUST NOT automatically retry a non-idempotent audio generation request.

#### Scenario: Request exceeds a configured limit
- **WHEN** the request body or text exceeds the configured maximum
- **THEN** the endpoint rejects it before provider dispatch with a stable validation error

#### Scenario: Caller exceeds the rate limit
- **WHEN** the caller exceeds the applicable audio generation rate limit
- **THEN** the endpoint rejects the request without invoking Alibaba and returns a sanitized rate-limit error

#### Scenario: Provider timeout occurs
- **WHEN** Alibaba does not complete within the configured timeout
- **THEN** the endpoint returns a sanitized timeout error and does not retry the generation automatically

### Requirement: Credentials remain server-only
The endpoint SHALL keep Alibaba API keys and authorization headers on the server and SHALL NOT include them in responses, client-visible metadata, or application logs.

#### Scenario: Audio request is processed
- **WHEN** the server dispatches an audio request using configured credentials
- **THEN** the response and logged request details contain no API key or authorization header
