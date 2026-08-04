# sdk-usage-docs Specification

## Purpose
The repository's usage documentation (README, examples, `.env.example` files) enables a developer to configure each supported Provider, invoke the unified image and video APIs, and interpret results and errors without reading implementation internals.

## Requirements
### Requirement: SDK usage and configuration are discoverable
The repository SHALL document how to install/run the examples, copy each `.env.example`, construct each supported Provider, invoke the unified image API, and interpret returned image references and errors.

#### Scenario: A new developer follows the example documentation
- **WHEN** the developer starts from the repository documentation
- **THEN** they can identify a Provider example, required environment variables, the run command, and the expected success/error output without reading implementation internals

### Requirement: Video generation usage is documented

The repository SHALL document how to submit a video task via `submitVideoTask`, wait on the returned `TaskHandle<VideoContent[]>` (`task.wait()` with poll interval and timeout), and interpret the single-element `VideoContent[]` result (URL + metadata). The documentation SHALL cover the media input shapes per mode: t2v (prompt only), i2v (`firstFrame`), r2v (`referenceImages`, 1-9, `[Image N]` prompt references), and video-edit (`inputVideo` + optional `referenceImages`, 0-5).

#### Scenario: A developer runs the video example

- **WHEN** the developer copies the video example `.env.example`, sets the Aliyun credentials, and follows the documented run command
- **THEN** they can submit a t2v or i2v task, wait for completion, and locate the saved video output without reading the adapter source

#### Scenario: A developer composes an r2v or video-edit request

- **WHEN** the developer reads the video usage documentation
- **THEN** they can identify which media inputs each video model mode requires (`firstFrame` vs `referenceImages` vs `inputVideo`) and the per-mode `providerOptions.aliyun` parameter support (`ratio`/`duration`/`audio_setting` restrictions)

### Requirement: Provider capability differences are documented
Documentation and Playground model choices SHALL identify supported generation/edit capabilities and Alibaba recommended model use cases. `z-image-turbo` MUST be described as generation-only and MUST NOT be presented as an editable model.

#### Scenario: Choose an Alibaba model for editing
- **WHEN** a developer reads the model capability guidance or selects edit mode
- **THEN** only edit-capable models are offered and the generation-only limitation of `z-image-turbo` is clear

### Requirement: Documentation states the security boundary
Documentation SHALL state that Playground API keys are server-side environment configuration, the browser never receives Provider credentials, the Playground is controlled/development-only, and results are not durably stored.

#### Scenario: Deploy the Playground for a controlled test
- **WHEN** a developer reads the deployment/configuration guidance
- **THEN** the guidance identifies the controlled-use assumption and does not imply public multi-tenant or persistent service behavior

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

