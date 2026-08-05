## Purpose

A dev/test-only package that uploads local files to Aliyun DashScope and Google Gemini temporary storage, returning provider-specific temporary URLs with expiry metadata and required downstream headers, decoupled from the core SDK generation contract.

## ADDED Requirements

### Requirement: Uploader package is independently addressable

The repository SHALL provide a `@ai-media/uploader` workspace package with subpath exports `./core`, `./aliyun`, and `./google`. The package SHALL NOT depend on `@ai-media/sdk`; each provider subpath SHALL resolve independently so a consumer importing `./aliyun` does not transitively pull the `./google` module and vice versa.

#### Scenario: Aliyun subpath resolves without Google

- **WHEN** a consumer imports `@ai-media/uploader/aliyun`
- **THEN** the module SHALL resolve and SHALL NOT transitively import the Google uploader module

#### Scenario: Google subpath resolves without Aliyun

- **WHEN** a consumer imports `@ai-media/uploader/google`
- **THEN** the module SHALL resolve and SHALL NOT transitively import the Aliyun uploader module

#### Scenario: Uploader package does not depend on the core SDK

- **WHEN** workspace dependency metadata is inspected
- **THEN** `@ai-media/uploader` SHALL NOT declare a runtime dependency on `@ai-media/sdk`

### Requirement: Shared UploadedFile contract carries URL and downstream metadata

The `./core` subpath SHALL export an `UploadedFile` type carrying `url`, optional `mimeType`, optional `sizeBytes`, optional `expiresAt`, and optional `requiresHeaders` (a map of HTTP headers the caller SHALL send when passing the URL to a model). It SHALL also export an `UploaderError` type with a string `code`, optional numeric `statusCode`, and optional `cause`, plus stable error code constants.

#### Scenario: Aliyun upload result carries required headers

- **WHEN** an Aliyun upload completes
- **THEN** the returned `UploadedFile.url` SHALL start with `oss://`, `expiresAt` SHALL be set to 48 hours after upload, and `requiresHeaders` SHALL contain `X-DashScope-OssResourceResolve: enable`

#### Scenario: Google upload result carries a standard URI

- **WHEN** a Google upload completes
- **THEN** the returned `UploadedFile.url` SHALL start with `https://`, `expiresAt` SHALL be set to 48 hours after upload, and `requiresHeaders` SHALL be absent or empty

### Requirement: Aliyun DashScope upload produces an oss:// temporary URL

The `./aliyun` subpath SHALL expose a factory that accepts an API key and optional base URL, timeout, and fetch override, returning an uploader whose `upload` method accepts `{ model, filePath | fileBytes, fileName }` and performs the three-step DashScope flow (get policy → multipart POST to OSS → return `oss://{upload_dir}/{fileName}`). The `upload` method SHALL require a `model` parameter because DashScope binds uploaded files to the model that will later consume them.

#### Scenario: Successful Aliyun upload returns oss URL

- **WHEN** `upload` is called with a valid API key, a model name, and a readable local file
- **THEN** the method SHALL fetch an upload policy, POST the file as multipart/form-data to the policy's `uploadHost` with the documented form fields (`OSSAccessKeyId`, `Signature`, `policy`, `x-oss-object-acl`, `x-oss-forbid-overwrite`, `key`, `success_action_status`, `file` as the last field), and return an `UploadedFile` whose `url` is `oss://{upload_dir}/{fileName}`

#### Scenario: Aliyun upload requires a model

- **WHEN** `upload` is called without a `model`
- **THEN** the method SHALL throw `UploaderError` with code `INVALID_REQUEST` before any network call

#### Scenario: Aliyun upload requires a file source

- **WHEN** `upload` is called with neither `filePath` nor `fileBytes`
- **THEN** the method SHALL throw `UploaderError` with code `INVALID_REQUEST` before any network call

#### Scenario: Aliyun policy rate limit is classified

- **WHEN** the policy endpoint returns HTTP 429
- **THEN** the method SHALL throw `UploaderError` with code `RATE_LIMITED`

#### Scenario: Aliyun policy failure is classified

- **WHEN** the policy endpoint returns a non-2xx status other than 429
- **THEN** the method SHALL throw `UploaderError` with code `POLICY_ERROR` and the HTTP status as `statusCode`

#### Scenario: Aliyun OSS upload failure is classified

- **WHEN** the OSS multipart POST returns a non-200 status
- **THEN** the method SHALL throw `UploaderError` with code `UPLOAD_ERROR` and the HTTP status as `statusCode`

### Requirement: Google Gemini upload produces a standard URI with lifecycle

The `./google` subpath SHALL expose a factory that accepts an API key and optional base URL, timeout, and fetch override, returning an uploader with `upload`, `get`, `list`, and `delete` methods. `upload` SHALL use the resumable protocol (start → upload+finalize) and return an `UploadedFile` carrying the file resource `name`, the `https://` URI, and a `PROCESSING`/`ACTIVE`/`FAILED` state. `list` SHALL be an async iterable that follows pagination.

#### Scenario: Successful Google upload returns a URI

- **WHEN** `upload` is called with a valid API key, file bytes, file name, and MIME type
- **THEN** the method SHALL issue a resumable start request to obtain an upload URL, POST the bytes with `X-Goog-Upload-Command: upload, finalize`, and return an `UploadedFile` whose `url` is the file's `https://` URI and whose `name` is the file resource name

#### Scenario: Google upload requires MIME type for in-memory bytes

- **WHEN** `upload` is called with `fileBytes` but no `mimeType`
- **THEN** the method SHALL throw `UploaderError` with code `INVALID_REQUEST` before any network call

#### Scenario: Google get retrieves file metadata

- **WHEN** `get` is called with a file `name`
- **THEN** the method SHALL return the current `UploadedFile` metadata including `state`

#### Scenario: Google list yields all files

- **WHEN** `list` is iterated
- **THEN** the method SHALL follow `nextPageToken` pagination and yield every file as an `UploadedFile`

#### Scenario: Google delete removes a file

- **WHEN** `delete` is called with a file `name`
- **THEN** the method SHALL issue a DELETE and resolve; a subsequent `get` for that name SHALL surface a not-found error

#### Scenario: Google not-found is classified

- **WHEN** a `get` or `delete` targets a non-existent file name (HTTP 404)
- **THEN** the method SHALL throw `UploaderError` with code `NOT_FOUND`

### Requirement: Uploader is positioned for development and testing only

The `@ai-media/uploader` package and its documentation SHALL state that temporary-file upload is intended for development and testing, not for production, high-concurrency, or load-test scenarios, because the Aliyun policy endpoint is rate-limited to 100 QPS per account+model and temporary URLs expire after 48 hours. The Aliyun uploader SHALL expose only the `upload` method (DashScope does not support query, modification, or download of uploaded files); the package SHALL NOT guarantee long-term URL availability and SHALL NOT replace durable storage such as Aliyun OSS or Google Cloud Storage.

#### Scenario: Aliyun uploaded files are not queryable

- **WHEN** the Aliyun uploader's public method surface is inspected
- **THEN** it SHALL expose only `upload` and SHALL NOT expose list, get, or delete methods
