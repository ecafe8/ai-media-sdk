## Why

The Alibaba audio SDK now exposes CosyVoice text-to-speech generation, including SSML controls and LaTeX formula pass-through, but neither Playground can use the audio modality. Users therefore have no safe, integrated way to try these capabilities or discover the model and input constraints from the project site.

## What Changes

- Add an audio generation flow to the server-proxied `apps/web` Playground.
- Expose an independent audio workbench with text, voice, format, rate, pitch, volume, and SSML controls.
- Pass SSML and LaTeX text unchanged to the Alibaba provider; do not parse, rewrite, or render either syntax in the SDK or Playground.
- Project supported Alibaba audio models as audio models instead of image models, initially exposing CosyVoice models suitable for the first slice.
- Add audio request validation, provider selection, result mapping, browser playback, download, and safe error handling.
- Apply server-side abuse and resource protections to the new audio endpoint, including request-size, timeout, and rate-limit boundaries without exposing provider credentials.
- Add Chinese and English site documentation for audio generation, CosyVoice, SSML, LaTeX, temporary audio URLs, and provider limitations.
- Keep `apps/site` browser-side TTS execution and runnable audio-model projection out of the first implementation slice until the BYO-key and CORS behavior is explicitly resolved.

## Capabilities

### New Capabilities

- `audio-playground`: Generate and play Alibaba CosyVoice audio from the server-proxied Playground, including SSML and LaTeX pass-through.
- `audio-generation-docs`: Document the SDK audio API and Alibaba CosyVoice SSML/LaTeX behavior in the site documentation.

### Modified Capabilities

- None.

## Impact

- `apps/web` Playground types, registry projection, API route validation, server executor, audio workbench, and result feed.
- Alibaba audio model metadata projection in `apps/web`; `apps/site` remains non-runnable for audio in this slice.
- `apps/site` MDX content and documentation manifest; no browser-side provider execution in this slice.
- Existing `@ai-media/sdk` and `@ai-media/provider-aliyun-bailian` audio APIs are reused without changing their public contracts.
- No new runtime dependency or credential storage behavior.
