## ADDED Requirements

### Requirement: Playground exposes extended HappyHorse video modes

The Playground SHALL expose configured HappyHorse r2v and video-edit models with controls for their required media: one to nine reference image URLs for r2v, and one source video URL plus zero to five reference image URLs for video-edit. It SHALL communicate unsupported parameter combinations, including the absence of `ratio` and `duration` for video-edit.

#### Scenario: Configure r2v

- **WHEN** the user selects a configured HappyHorse r2v model
- **THEN** the form SHALL expose ordered reference image inputs and allow submission only when at least one valid reference image is present

#### Scenario: Configure video-edit

- **WHEN** the user selects a configured HappyHorse video-edit model
- **THEN** the form SHALL expose a source video URL, optional reference image inputs, and video-edit-compatible parameters

#### Scenario: Invalid extended video input is blocked

- **WHEN** the user submits r2v without references or video-edit without a source video
- **THEN** the form SHALL show an associated validation message and SHALL not call the server route
