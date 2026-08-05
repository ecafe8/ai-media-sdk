## ADDED Requirements

### Requirement: Uploader example is runnable and minimal

The repository SHALL provide a runnable `examples/uploader-aliyun` Node.js example that loads its documented environment configuration, constructs the Aliyun uploader through `@ai-media/uploader/aliyun`, uploads a local image file bound to a Qwen-VL model, then calls the unified image-generation API with the returned `oss://` URL, and prints a useful success or failure summary. The example SHALL depend on `@ai-media/uploader` and `@ai-media/provider-aliyun-bailian` only and SHALL NOT add a real-network call to default tests.

#### Scenario: Run the uploader example with valid configuration

- **WHEN** a developer supplies the documented Aliyun variables and a local image path and runs the example's documented Bun command
- **THEN** the example uploads the file, invokes the Qwen-VL model with the `oss://` URL, and prints the model's response or a stable error

#### Scenario: Run the uploader example without configuration

- **WHEN** a required Aliyun variable is missing
- **THEN** the example exits without a network call and prints an actionable missing-configuration message that does not contain secrets

### Requirement: Uploader examples are constrained to development use

Uploader examples SHALL be marked as development/test-only and SHALL NOT be used as templates for production, high-concurrency, or load-test scenarios. Example documentation SHALL state the 48-hour temporary-URL expiry and the 100 QPS Aliyun policy rate limit, and SHALL direct production callers to durable storage such as Aliyun OSS.

#### Scenario: Uploader example documents production constraints

- **WHEN** the example's `.env.example` or usage documentation is inspected
- **THEN** it SHALL state that temporary URLs expire in 48 hours and that the Aliyun policy endpoint is rate-limited and not for production
