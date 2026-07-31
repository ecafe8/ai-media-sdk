## ADDED Requirements

### Requirement: Async task submission dispatches through a provider-bound model instance

The core `submitTask<TContent>` function SHALL accept a task submission carrying a provider-bound model instance and a modality-neutral `AdapterRequest`, validate `model.capabilities.async`, and dispatch to `model.adapter.submit()` instead of throwing. It SHALL reject a model whose `async` capability is false/undefined with `INVALID_REQUEST` before any transport call.

#### Scenario: submitTask dispatches to the bound adapter submit

- **WHEN** `submitTask` is called with a request whose `model` declares `async: true`
- **THEN** it SHALL build an `AdapterRequest` and invoke the adapter `submit`, returning the adapter's `TaskHandle<TContent>`

#### Scenario: Non-async model is rejected before dispatch

- **WHEN** `submitTask` is called with a model whose `async` capability is false/undefined
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter

### Requirement: TaskHandle wait polls a provider-supplied closure to a terminal state

The core `createTaskHandle<TContent>` helper SHALL construct a `TaskHandle<TContent>` whose `wait(options?)` loops a provider-supplied `poll()` callback until a terminal status (`succeeded`/`failed`/`cancelled`), sleeping `pollIntervalMs` (default 15000ms) between polls and timing out at `timeoutMs` (default 600000ms). `wait` SHALL accept an optional `AbortSignal` and SHALL resolve with the `GenerationResult<TContent>` on success or reject with the terminal `SdkError` on failure.

#### Scenario: wait resolves when poll reaches succeeded

- **WHEN** `poll()` returns `{ status: "succeeded", result }` after pending/running states
- **THEN** `wait()` SHALL resolve with the `result` `GenerationResult<TContent>`

#### Scenario: wait rejects when poll reaches failed

- **WHEN** `poll()` returns `{ status: "failed", error }`
- **THEN** `wait()` SHALL reject with the `error` `SdkError`

#### Scenario: wait times out when the task never terminates

- **WHEN** `poll()` never returns a terminal status within `timeoutMs`
- **THEN** `wait()` SHALL reject with an `SdkError` with code `TIMEOUT`

#### Scenario: wait respects an abort signal between polls

- **WHEN** the caller aborts the supplied `signal` while polling
- **THEN** `wait()` SHALL reject promptly without further polls

### Requirement: Provider adapter gains an optional async submit method

The `ProviderAdapter<TContent>` contract SHALL expose an optional `submit(request: AdapterRequest): Promise<TaskHandle<TContent>>` method. Sync-only Providers SHALL omit `submit`; `submitTask` SHALL fail with `INVALID_REQUEST` when the bound adapter does not implement it.

#### Scenario: submit is optional on sync-only providers

- **WHEN** a model is bound to an adapter that omits `submit`
- **THEN** `submitTask` SHALL throw an `SdkError` with code `INVALID_REQUEST` before dispatch

### Requirement: Model capability declares async support

`ModelCapability` SHALL carry an optional `async?: boolean` flag. Async-capable models (e.g. Aliyun video) SHALL set `async: true`; sync-only models SHALL leave it undefined.

#### Scenario: async capability gates submitTask

- **WHEN** a consumer calls `submitTask` on a model
- **THEN** the core SHALL dispatch only when `model.capabilities.async` is true

### Requirement: Video content specializes the generic result contract

The `@ai-media/sdk` package SHALL export a `VideoContent` type carrying `url`, optional `mimeType`, `duration`, `width`, and `height`. Video generation SHALL use `GenerationResult<VideoContent[]>` or `TaskHandle<VideoContent[]>` so a single result can carry one or more videos while `GenerationResult<TContent>` stays generic.

#### Scenario: Video content resolves through the workspace export

- **WHEN** a workspace consumer imports `VideoContent` from `@ai-media/sdk`
- **THEN** the symbol SHALL resolve from the package root export without requiring `src/*`

### Requirement: submitVideoTask binds the video modality entry

The core `submitVideoTask(request)` function SHALL accept a video request carrying a provider-bound video model instance, a `prompt`, an optional `firstFrame: ImageContent` (for first-frame i2v), and `providerOptions`, validate `model.capabilities.async` and the video modality, build a modality-neutral `AdapterRequest`, and dispatch to `model.adapter.submit()` returning a `TaskHandle<VideoContent[]>`. It SHALL reject an empty `prompt` and a missing `firstFrame` when the model requires first-frame input with `INVALID_REQUEST`.

#### Scenario: submitVideoTask dispatches for a t2v model

- **WHEN** `submitVideoTask` is called with an async t2v model and a non-empty prompt
- **THEN** it SHALL return a `TaskHandle<VideoContent[]>` bound to the adapter `submit`

#### Scenario: empty prompt is rejected before dispatch

- **WHEN** `submitVideoTask` is called with an empty prompt
- **THEN** it SHALL throw an `SdkError` with code `INVALID_REQUEST` and SHALL not invoke the adapter
