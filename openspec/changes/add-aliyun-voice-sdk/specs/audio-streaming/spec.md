## Purpose

Provide a streaming text-to-speech contract that preserves Alibaba SSE sentence events, ordered audio chunks, optional word timestamps, cancellation, and terminal results without forcing callers to buffer the entire audio response.

## ADDED Requirements

### Requirement: Streaming audio exposes ordered provider-independent events

The SDK SHALL expose an async stream of discriminated audio events for supported streaming TTS models. Sentence events SHALL preserve provider order, synthesis events SHALL carry ordered Base64 audio chunks, and the terminal event SHALL indicate completion.

#### Scenario: Streaming synthesis emits ordered chunks
- **WHEN** a valid streaming TTS request receives multiple `sentence-synthesis` events
- **THEN** the SDK SHALL yield each audio chunk in arrival order with its audio identifier and model/request identity when available

#### Scenario: Sentence boundaries are preserved
- **WHEN** the provider emits `sentence-begin` or `sentence-end`
- **THEN** the SDK SHALL expose the original sentence text and sentence index when provided

#### Scenario: Final event exposes complete audio URL
- **WHEN** the provider's terminal event contains an audio URL
- **THEN** the SDK SHALL expose the temporary URL and expiry timestamp without requiring callers to concatenate chunks

### Requirement: Streaming supports timestamps, cancellation, and errors

The streaming contract SHALL support optional word-level timestamps, an abort signal, and classified terminal errors. Aborting SHALL stop consumption and SHALL NOT be reported as successful completion.

#### Scenario: Word timestamps are returned when enabled
- **WHEN** a supported request enables word timestamps and the provider returns word timing data
- **THEN** the SDK SHALL expose each word's text, character indexes, and begin/end times in milliseconds

#### Scenario: Caller aborts a stream
- **WHEN** the caller aborts the stream's signal during synthesis
- **THEN** the SDK SHALL terminate the stream with an abort-related error and SHALL not emit a successful terminal event

#### Scenario: Provider stream returns an error
- **WHEN** an SSE chunk contains a provider failure
- **THEN** the SDK SHALL surface a sanitized classified SDK error and SHALL not silently discard prior or subsequent stream state
