# model-family-typing Specification

## Purpose
Lets SDK consumers get compile-time TypeScript hints for model-specific parameters: when a caller selects a known model id via a Provider factory (`image("gpt-image-2")`), the returned model instance narrows the request's `size`/`n` literal unions and `providerOptions.<namespace>` shape for that model family, so the IDE surfaces only the values the model accepts.
## Requirements
### Requirement: ModelInstance carries a phantom type parameter for family-specific params

`@ai-media/sdk` `ModelInstance<TContent, TParams>` SHALL accept a third optional type parameter `TParams` defaulting to `ImageGenerationInput` for image models and `VideoGenerationInput` for video models. The `TParams` parameter SHALL be phantom: it MUST NOT add runtime state to model instances, MUST NOT change the runtime shape of `providerId`/`modelId`/`adapter`/`capabilities`, and MUST NOT require any adapter to read it. The default value MUST preserve backwards compatibility so existing call sites that pass a `string` model id to a Provider factory continue to type-check unchanged.

#### Scenario: Default TParams keeps existing call sites compiling

- **WHEN** a consumer calls `provider.image(someStringModelId)` and pipes the result into `generateImage({ model, prompt, size, n })` without any family-specific type
- **THEN** the call SHALL type-check against the default `TParams` with no `// @ts-expect-error` required, and `size`/`n` SHALL retain their existing `string`/`number` types

#### Scenario: TParams does not change runtime shape

- **WHEN** a caller compares two model instances created with the same `modelId` but different `TParams` (one family-typed via literal overload, one via the string fallback)
- **THEN** both instances SHALL have identical runtime shapes (`providerId`, `modelId`, `adapter`, `capabilities`) and SHALL be interchangeable at runtime

### Requirement: Provider factories expose per-family literal-id overloads returning typed instances

Every Provider package exposing an image or video factory SHALL provide `image(modelId)` and/or `video(modelId)` overloads keyed by each known model id literal listed in that Provider's in-package registry — currently Azure `gpt-image-2`, the Aliyun Qwen/Wan image models and HappyHorse/Wan 3.0 video models, each Seedream image model, and MiniMax `MiniMax-H3` video. Each overload SHALL return a `ModelInstance` whose `TParams` narrows `size` to the model's allowed literal union, `n` to the model's allowed literal type (when `maxN` is small enough to enumerate), and `providerOptions` to `{ readonly <namespace>?: <ProviderFamilyOptions> }` for that Provider's namespace (required, not optional, when the Provider's API mandates the namespace, e.g. MiniMax-H3). Each Provider SHALL also expose a fallback overload keyed by `modelId: string` returning `ModelInstance<TContent, DefaultParams>` so dynamic model ids (including Playground server.ts) type-check without narrowing.

#### Scenario: Azure literal overload narrows size to documented Azure values

- **WHEN** a consumer calls `azure.image("gpt-image-2")` and passes the result as `model` to `generateImage`
- **THEN** TypeScript SHALL reject `size: "4096x4096"` with a compile-time error, and SHALL accept `size: "1024x1024"`, `size: "1024x1536"`, `size: "1536x1024"`, and `size: "auto"`

#### Scenario: Aliyun Qwen overload narrows providerOptions to the Aliyun namespace

- **WHEN** a consumer calls `aliyun.image("qwen-image-2.0-pro")` and passes the result to `generateImage` with `providerOptions: { aliyun: { negative_prompt: "..." } }`
- **THEN** the call SHALL type-check; when the same consumer writes `providerOptions: { azure: { quality: "high" } }`, TypeScript SHALL flag the `azure` key as not assignable to the family's `TParams["providerOptions"]`

#### Scenario: Seedream overload narrows size to the model's tier enum

- **WHEN** a consumer calls `seedream.image("doubao-seedream-5-0-pro-260628")` and passes the result to `generateImage`
- **THEN** TypeScript SHALL accept `size: "1K"` and `size: "2K"` and SHALL reject `size: "4K"` at compile time

#### Scenario: MiniMax video overload narrows resolution, ratio, and duration

- **WHEN** a consumer calls `minimax.video("MiniMax-H3")` and passes the result to `submitVideoTask`
- **THEN** TypeScript SHALL accept `resolution: "768P" | "2K"`, `duration` in `4..15`, and the documented ratio union, and SHALL reject `resolution: "1080P"`, `duration: 3`, or `ratio: "2:1"` at compile time

#### Scenario: String fallback overload preserves default typing for dynamic ids

- **WHEN** Playground server.ts calls `provider.image(request.model)` with `request.model: string`
- **THEN** the call SHALL resolve to the string fallback overload, return `ModelInstance<ImageContent[], ImageGenerationInput>`, and `generateImage` SHALL accept any `size: string` and `n: number` without compile-time narrowing

### Requirement: Dispatch entry points accept the bound TParams

`@ai-media/sdk` `generateImage`, `editImage`, `submitImageTask`, and `submitVideoTask` SHALL each accept a generic `TParams` bounded by the corresponding base input (`ImageGenerationInput`, `ImageEditInput`, or `VideoGenerationInput`) and require the request fields (other than `model`) to satisfy the family param shape. The `model` field SHALL require the modality's model-instance alias parameterised by `TParams` (`ImageModelInstance<TParams>` / `VideoModelInstance<TParams>`) so the request's param shape is bound to the selected model.

#### Scenario: Typed model narrows request shape

- **WHEN** a consumer obtains `const model = azure.image("gpt-image-2")` (typed `ImageModelInstance<AzureGptImage2Params>`) and calls `generateImage({ model, prompt: "...", size: ... })`
- **THEN** the `size` literal SHALL be constrained to `AzureGptImage2Params["size"]`; an out-of-union value SHALL be a compile-time error

#### Scenario: Untyped model keeps default request shape

- **WHEN** a consumer obtains `const model = provider.image(someString)` (typed with default `TParams`) and calls `generateImage({ model, prompt: "...", size: "...", n: 2 })`
- **THEN** the call SHALL type-check with `size: string` and `n: number`, matching the pre-change contract
