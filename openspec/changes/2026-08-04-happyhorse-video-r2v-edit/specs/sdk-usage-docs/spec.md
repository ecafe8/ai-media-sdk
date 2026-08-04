## ADDED Requirements

### Requirement: Extended HappyHorse video usage is documented

The repository SHALL document r2v and video-edit examples or invocation patterns, including model IDs, required media inputs, media count limits, public URL requirements for source video, `providerOptions.aliyun.audio_setting`, and the fact that task IDs and result URLs expire after 24 hours.

#### Scenario: Developer follows an r2v example

- **WHEN** a developer reads the video example documentation
- **THEN** they SHALL identify how to provide ordered reference images and use `[Image N]` prompt references

#### Scenario: Developer follows a video-edit example

- **WHEN** a developer reads the video-edit documentation
- **THEN** they SHALL identify how to provide a public source video URL, optional references, and audio preservation settings
