## ADDED Requirements

### Requirement: Aliyun extended video modes use the shared transport

The Aliyun provider SHALL route HappyHorse r2v and video-edit submissions and polls exclusively through the injected shared `Transport`, using the existing bearer authentication and async task lifecycle. It SHALL not add a DashScope or other provider runtime SDK dependency.

#### Scenario: r2v uses injected transport

- **WHEN** an r2v task is submitted with an injected transport
- **THEN** both submission and task polling SHALL be observable through that transport

#### Scenario: video-edit uses injected transport

- **WHEN** a video-edit task is submitted with an injected transport
- **THEN** both submission and task polling SHALL be observable through that transport

### Requirement: Aliyun registry exposes extended video capabilities

The Aliyun model registry SHALL expose `happyhorse-1.1-r2v` as an async video model accepting exactly 1-9 reference images and `happyhorse-1.0-video-edit` as an async video model requiring exactly one input video and accepting 0-5 reference images.

#### Scenario: Extended models bind as async video models

- **WHEN** a caller binds either supported extended model
- **THEN** the resulting model SHALL declare `modality: "video"`, `async: true`, and the corresponding media requirements

### Requirement: Aliyun adapter validates media, prompt, and URLs before transport

The Aliyun adapter SHALL be the sole authority for model-specific validation and SHALL reject invalid requests with `INVALID_REQUEST` before any transport call. It SHALL validate: media presence and exclusivity per model (t2v rejects all media; i2v requires exactly one `firstFrame`; r2v requires 1-9 `referenceImages`; video-edit requires exactly one `inputVideo` and accepts 0-5 `referenceImages`), reference-image count limits, prompt presence (required for t2v/r2v/video-edit, optional for i2v), and that every `inputVideo` URL is a non-empty `http:`/`https:` URL.

#### Scenario: r2v rejects missing or excessive reference images

- **WHEN** an r2v request has zero or more than nine reference images
- **THEN** the adapter SHALL throw `INVALID_REQUEST` and SHALL not send a request

#### Scenario: video-edit rejects a missing source video

- **WHEN** a video-edit request has no `inputVideo`
- **THEN** the adapter SHALL throw `INVALID_REQUEST` and SHALL not send a request

#### Scenario: video-edit rejects a non-HTTP source video URL

- **WHEN** a video-edit `inputVideo` URL is missing, empty, or uses a non-`http:`/`https:` protocol
- **THEN** the adapter SHALL throw `INVALID_REQUEST` and SHALL not send a request

#### Scenario: incompatible media on a t2v model is rejected

- **WHEN** a t2v request carries `firstFrame`, `referenceImages`, or `inputVideo`
- **THEN** the adapter SHALL throw `INVALID_REQUEST` and SHALL not send a request

### Requirement: Aliyun validates native option values before transport

The Aliyun adapter SHALL validate the values of forwarded native options before any transport call: `audio_setting` SHALL be `"auto"` or `"origin"`, `resolution` SHALL be a supported tier, and `duration`/`seed` SHALL be numbers within the documented ranges. Invalid values SHALL throw `INVALID_REQUEST` before transport.

#### Scenario: audio_setting is validated

- **WHEN** a video-edit request supplies `audio_setting` other than `"auto"` or `"origin"`
- **THEN** the adapter SHALL throw `INVALID_REQUEST` and SHALL not send a request

#### Scenario: invalid resolution is rejected

- **WHEN** a video-edit request supplies `resolution` outside `720P`/`1080P`
- **THEN** the adapter SHALL throw `INVALID_REQUEST` and SHALL not send a request