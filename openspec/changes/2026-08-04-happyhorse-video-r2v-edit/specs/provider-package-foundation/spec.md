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

The Aliyun model registry SHALL expose `happyhorse-1.1-r2v` as an async video model accepting one to nine reference images and `happyhorse-1.0-video-edit` as an async video model requiring one input video and accepting zero to five reference images.

#### Scenario: Extended models bind as async video models

- **WHEN** a caller binds either supported extended model
- **THEN** the resulting model SHALL declare `modality: "video"`, `async: true`, and the corresponding media requirements
