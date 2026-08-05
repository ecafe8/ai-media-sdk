## MODIFIED Requirements

### Requirement: Seedream adapter dispatches by an in-package model registry
The Doubao-Seedream provider SHALL maintain an in-package model capability registry mapping each `modelId` to its capabilities, supported parameters, and accepted output formats. `provider.image(modelId)` SHALL bind a model instance to the shared adapter and SHALL reject an unknown model id with `UNKNOWN_MODEL`.

#### Scenario: Known Seedream model binds to the adapter

- **WHEN** `provider.image("doubao-seedream-5-0-pro-260628")` is called
- **THEN** it SHALL return an `ImageModelInstance` with `providerId` `doubao-seedream`, the model id, image-generation/edit capabilities, and the bound adapter

#### Scenario: Unknown model id is rejected

- **WHEN** `provider.image("not-a-real-model")` is called
- **THEN** it SHALL throw an `SdkError` with code `UNKNOWN_MODEL` and SHALL not send a request
