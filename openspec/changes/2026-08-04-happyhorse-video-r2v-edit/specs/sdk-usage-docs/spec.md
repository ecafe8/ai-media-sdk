## ADDED Requirements

### Requirement: Extended HappyHorse video usage is documented

The repository SHALL document r2v and video-edit examples or invocation patterns, including model IDs, required media inputs, media count limits, public `http:`/`https:` URL requirements for the source video, `providerOptions.aliyun.audio_setting` (`"auto"`/`"origin"`), the fact that `video-edit` does not accept `ratio`/`duration`, and the fact that task IDs and result URLs expire after 24 hours.

#### Scenario: Developer follows an r2v example

- **WHEN** a developer reads the video example documentation
- **THEN** they SHALL identify how to provide ordered reference images and use `[Image N]` prompt references

#### Scenario: Developer follows a video-edit example

- **WHEN** a developer reads the video-edit documentation
- **THEN** they SHALL identify how to provide a public `http:`/`https:` source video URL, optional references, and audio preservation settings, and that `ratio`/`duration` are not accepted

#### Scenario: Developer understands the video-edit URL requirement

- **WHEN** a developer reads the video-edit documentation
- **THEN** they SHALL understand that the source video must be a public `http:`/`https:` URL and that the SDK does not upload or accept local file paths or base64 video
