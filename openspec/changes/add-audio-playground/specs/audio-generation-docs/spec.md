## Purpose

Documents the SDK audio generation workflow and Alibaba CosyVoice SSML and LaTeX behavior so users can understand supported syntax, model limits, and temporary audio result handling.

## ADDED Requirements

### Requirement: Site documents audio generation
The site documentation SHALL provide Chinese and English audio-generation pages covering `generateAudio()`, the supported Alibaba CosyVoice models in this slice, required text and voice inputs, common audio options, and result formats.

#### Scenario: User opens the audio guide
- **WHEN** a user navigates to the audio-generation guide in either supported language
- **THEN** the page explains how to construct and submit an audio generation request and how to consume its result

### Requirement: Site documents SSML behavior
The documentation SHALL explain CosyVoice SSML enablement, the supported model and voice constraints, the Beijing-region limitation where applicable, root and commonly used tags, escaping requirements, and the one-request limitation for supported streaming protocols. It SHALL state that the current Playground does not provide streaming playback.

#### Scenario: User reads SSML guidance
- **WHEN** a user reads the SSML section
- **THEN** the page shows a safe code-block example and clearly identifies unsupported model, voice, and interface combinations

### Requirement: Site documents LaTeX behavior
The documentation SHALL explain that CosyVoice accepts supported Chinese LaTeX formulas through `$...$`, `$$...$$`, `\(...\)`, or `\[...\]`, that backslashes must be escaped in source strings and JSON, that formulas must contain formula content only, and that unsupported syntax may not be read accurately. It SHALL state that the current Playground passes formulas through and does not render or validate them.

#### Scenario: User reads LaTeX guidance
- **WHEN** a user reads the LaTeX section
- **THEN** the page shows an escaped source-string example and states that the formula must contain formula content only

### Requirement: Site documents audio lifecycle constraints
The documentation SHALL explain URL and inline Base64 results, temporary URL expiry, caller-controlled persistence, streaming chunk limitations, and the distinction between SDK pass-through and client-side formula or SSML parsing. It SHALL distinguish browser-playable `mp3`/`wav` output from download-only PCM or other non-playable formats.

#### Scenario: User handles generated audio
- **WHEN** a user follows the result-handling guidance
- **THEN** the user is told to download or persist temporary audio URLs when longer-term access is required
