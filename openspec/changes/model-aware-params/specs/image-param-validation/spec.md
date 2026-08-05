## Purpose

Lets callers of `generateImage` get pre-flight, capability-driven validation of the public `size` and `n` parameters before any network call, so models cannot silently receive unsupported values and callers cannot exceed a model's declared maximum output count.

## ADDED Requirements

### Requirement: Core validates image size against model capabilities before dispatch

`@ai-media/sdk` `generateImage` SHALL validate the public `size` parameter against the bound model's `ModelCapability` before dispatching to the Provider adapter. When `capabilities.supportedSizes` is defined, `size` MUST be one of its entries (case-sensitive). When `capabilities.supportedSizes` is undefined but `capabilities.maxResolution` is defined, `size` MUST match the pixel form `^\d+[x*]\d+$` (case-insensitive) and the parsed width/height MUST not exceed `maxResolution.width`/`maxResolution.height`. When both `supportedSizes` and `maxResolution` are defined, a `size` that matches an entry in `supportedSizes` SHALL pass; otherwise the pixel-form + cap check SHALL apply. When neither field is defined, `size` SHALL pass through unchanged to preserve backwards compatibility. Any validation failure SHALL throw an `SdkError` with `code: "INVALID_REQUEST"` and a message naming the offending value and the allowed set or cap; the message SHALL NOT include credentials, prompts, or request bodies.

#### Scenario: Tier value accepted when in supportedSizes

- **WHEN** `generateImage` is called with `size: "2K"` against a model whose `capabilities.supportedSizes` includes `"2K"`
- **THEN** the request SHALL dispatch to the adapter without throwing

#### Scenario: Pixel size accepted when within maxResolution

- **WHEN** `generateImage` is called with `size: "1024x1024"` against a model whose `capabilities.maxResolution` is `{ width: 2048, height: 2048 }` and `supportedSizes` is undefined
- **THEN** the request SHALL dispatch to the adapter without throwing

#### Scenario: Star separator accepted as pixel form

- **WHEN** `generateImage` is called with `size: "1024*1024"` against a model whose `capabilities.maxResolution` permits it
- **THEN** the request SHALL dispatch to the adapter without throwing

#### Scenario: Tier value rejected when outside supportedSizes

- **WHEN** `generateImage` is called with `size: "8K"` against a model whose `capabilities.supportedSizes` is `["1K","2K","4K"]`
- **THEN** the call SHALL throw an `SdkError` with `code: "INVALID_REQUEST"` before any network call, and the message SHALL name `"8K"` and the allowed values

#### Scenario: Pixel size rejected when exceeding maxResolution

- **WHEN** `generateImage` is called with `size: "4096x4096"` against a model whose `capabilities.maxResolution` is `{ width: 2048, height: 2048 }`
- **THEN** the call SHALL throw an `SdkError` with `code: "INVALID_REQUEST"` before any network call, and the message SHALL name the parsed size and the cap

#### Scenario: Non-pixel value rejected when only maxResolution is defined

- **WHEN** `generateImage` is called with `size: "huge"` against a model whose `capabilities.maxResolution` is defined but `supportedSizes` is undefined
- **THEN** the call SHALL throw an `SdkError` with `code: "INVALID_REQUEST"` before any network call

#### Scenario: Tier-then-pixel fallback when both fields are defined

- **WHEN** `generateImage` is called with `size: "2K"` against a model whose `supportedSizes` is `["1K","2K"]` and `maxResolution` is `{ width: 2048, height: 2048 }`, and then called with `size: "1024x1024"`
- **THEN** both calls SHALL dispatch to the adapter without throwing

#### Scenario: Undefined size always passes

- **WHEN** `generateImage` is called without `size` against any model
- **THEN** the request SHALL dispatch to the adapter without throwing, regardless of `supportedSizes`/`maxResolution`

#### Scenario: Backwards-compatible pass-through for untyped models

- **WHEN** `generateImage` is called with `size: "anything"` against a model whose `capabilities` declares neither `supportedSizes` nor `maxResolution`
- **THEN** the request SHALL dispatch to the adapter with `size: "anything"` unchanged

### Requirement: Core validates image output count against maxN before dispatch

`@ai-media/sdk` `generateImage` SHALL validate the public `n` parameter against `capabilities.maxN` when defined. `n` MUST be a positive integer not greater than `maxN`; any violation SHALL throw an `SdkError` with `code: "INVALID_REQUEST"` and a message naming the offending value and the cap. When `maxN` is undefined, the existing positive-integer check SHALL still apply.

#### Scenario: n within maxN accepted

- **WHEN** `generateImage` is called with `n: 4` against a model whose `capabilities.maxN` is `6`
- **THEN** the request SHALL dispatch to the adapter without throwing

#### Scenario: n exceeding maxN rejected

- **WHEN** `generateImage` is called with `n: 8` against a model whose `capabilities.maxN` is `6`
- **THEN** the call SHALL throw an `SdkError` with `code: "INVALID_REQUEST"` before any network call, and the message SHALL name `8` and the cap `6`

#### Scenario: maxN undefined keeps positive-integer floor

- **WHEN** `generateImage` is called with `n: 0` against a model whose `capabilities.maxN` is undefined
- **THEN** the call SHALL throw an `SdkError` with `code: "INVALID_REQUEST"`
