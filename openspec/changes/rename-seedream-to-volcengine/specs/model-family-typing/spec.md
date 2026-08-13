## MODIFIED Requirements

### Requirement: Provider factories expose per-family literal-id overloads returning typed instances

Every Provider package exposing an image or video factory SHALL provide `image(modelId)` and/or `video(modelId)` overloads keyed by each known model id literal listed in that Provider's in-package registry — currently Azure `gpt-image-2`, the Aliyun Qwen/Wan image models and HappyHorse/Wan 3.0 video models, each Volcengine Ark Seedream image model, and MiniMax `MiniMax-H3` video. Each overload SHALL return a `ModelInstance` whose `TParams` narrows `size` to the model's allowed literal union, `n` to the model's allowed literal type (when `maxN` is small enough to enumerate), and `providerOptions` to `{ readonly <namespace>?: <ProviderFamilyOptions> }` for that Provider's namespace (required, not optional, when the Provider's API mandates the namespace, e.g. MiniMax-H3). Each Provider SHALL also expose a fallback overload keyed by `modelId: string` returning `ModelInstance<TContent, DefaultParams>` so dynamic model ids (including Playground server.ts) type-check without narrowing.

#### Scenario: Azure literal overload narrows size to documented Azure values

- **WHEN** a consumer calls `azure.image("gpt-image-2")` and passes the result as `model` to `generateImage`
- **THEN** TypeScript SHALL reject `size: "4096x4096"` with a compile-time error, and SHALL accept `size: "1024x1024"`, `size: "1024x1536"`, `size: "1536x1024"`, and `size: "auto"`

#### Scenario: Aliyun Qwen overload narrows providerOptions to the Aliyun namespace

- **WHEN** a consumer calls `aliyun.image("qwen-image-2.0-pro")` and passes the result to `generateImage` with `providerOptions: { aliyun: { negative_prompt: "..." } }`
- **THEN** the call SHALL type-check; when the same consumer writes `providerOptions: { azure: { quality: "high" } }`, TypeScript SHALL flag the `azure` key as not assignable to the family's `TParams["providerOptions"]`

#### Scenario: Volcengine Ark Seedream overload narrows size to the model's tier enum

- **WHEN** a consumer calls `volcengine.image("doubao-seedream-5-0-pro-260628")` and passes the result to `generateImage`
- **THEN** TypeScript SHALL accept `size: "1K"` and `size: "2K"` and SHALL reject `size: "4K"` at compile time

#### Scenario: MiniMax video overload narrows resolution, ratio, and duration

- **WHEN** a consumer calls `minimax.video("MiniMax-H3")` and passes the result to `submitVideoTask`
- **THEN** TypeScript SHALL accept `resolution: "768P" | "2K"`, `duration` in `4..15`, and the documented ratio union, and SHALL reject `resolution: "1080P"`, `duration: 3`, or `ratio: "2:1"` at compile time

#### Scenario: String fallback overload preserves default typing for dynamic ids

- **WHEN** Playground server.ts calls `provider.image(request.model)` with `request.model: string`
- **THEN** the call SHALL resolve to the string fallback overload, return `ModelInstance<ImageContent[], ImageGenerationInput>`, and `generateImage` SHALL accept any `size: string` and `n: number` without compile-time narrowing
