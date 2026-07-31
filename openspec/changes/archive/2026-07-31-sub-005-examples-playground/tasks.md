## 1. Workspace and Provider Examples

- [x] 1.1 Inspect the current root workspace/package conventions and first-party Provider public exports, then add the `examples/*` workspace configuration without changing existing package names.
- [x] 1.2 Add one minimal Node.js/Bun image-generation example per currently supported first-party Provider, using one conservative request and the unified SDK API.
- [x] 1.3 Add example-level missing-environment validation, safe error reporting, and a documented run command; ensure defaults never batch, fallback, or retry high-cost requests.
- [x] 1.4 Add deterministic example smoke coverage for missing configuration and request construction using mocked transport/SDK boundaries, with no live Provider calls in default verification.

## 2. Environment Templates and Capability Registry

- [x] 2.1 Add a `.env.example` beside each first-party Provider example with required/optional variables, format descriptions, and placeholder values only.
- [x] 2.2 Add a shared typed Playground capability/configuration registry describing Provider labels, model labels, configured status, generation/edit support, input limits, and recommended use cases.
- [x] 2.3 Register Alibaba Bailian recommendations for `wan2.7-image-pro`, `wan2.7-image`, and `z-image-turbo`, explicitly marking `z-image-turbo` as generation-only and filtering it from edit mode.
- [x] 2.4 Add server-side configuration resolution that exposes only non-secret availability/capability data to the client and fails closed when required environment variables are missing.

## 3. Playground Server Boundary

- [x] 3.1 Define the internal JSON request/response types for `POST /api/playground/generate`, including text-to-image/edit mode, prompt, model/provider, public parameters, reference-image URL, lifecycle status, result images, metadata, and stable errors.
- [x] 3.2 Implement request validation for prompt, provider/model pairing, mode capability, reference URL shape/count, and supported public parameters before SDK dispatch; reject credential fields.
- [x] 3.3 Implement server-only Provider construction from environment configuration and dispatch through the existing unified SDK generate/edit API without importing secrets into client code.
- [x] 3.4 Map SDK/provider success, processing, configuration, validation, timeout, network, and unknown failures to sanitized stable envelopes; do not return or log credentials, authorization headers, stacks, raw bodies, or image content.
- [x] 3.5 Add route tests with mocked SDK/provider boundaries for valid generation, edit capability rejection, missing configuration, malformed input, processing/success mapping, and sanitized failure responses.

## 4. Playground Form and Workspace UI

- [x] 4.1 Replace the starter `apps/web` page with a responsive two-pane Playground workspace using existing `@workspace/ui` components and shared styles.
- [x] 4.2 Build the left control panel with visible labels, Provider/model selection, text-to-image/edit mode tabs, capability help text, prompt textarea, example prompt chips, reference-image URL input, supported size/aspect/output controls, reset, and Generate actions.
- [x] 4.3 Add capability-aware form behavior: hide or explain unsupported edit fields, clear or validate incompatible values when switching models, prevent empty prompts, and preserve input after errors.
- [x] 4.4 Implement client submission state with duplicate-submit prevention and accessible status announcements for ready, submitting, processing, failed, and succeeded states.
- [x] 4.5 Build the right result feed with empty/configuration/unsupported states, status cards, image preview placeholders, returned image previews, URL display, MIME/dimension/provider/model metadata, and safe error/retry presentation.
- [x] 4.6 Verify desktop split layout and narrow-screen stacked layout have no horizontal overflow, maintain keyboard focus visibility, associate errors with controls, and provide image alternative text.
- [x] 4.7 Add UI tests for form validation, model capability filtering, loading/processing/success/failure/empty states, and responsive-critical rendering paths using mocked route responses.

## 5. Usage and Configuration Documentation

- [x] 5.1 Document the examples workspace, per-Provider setup, `.env.example` copy steps, run commands, unified SDK call shape, and expected output/error behavior.
- [x] 5.2 Document the Playground route/use flow, supported Provider/model capabilities, Alibaba recommendation trade-offs, and the generation-only status of `z-image-turbo`.
- [x] 5.3 Document the security and lifecycle boundary: server-only credentials, controlled/development use, no user system, no durable history/storage, and temporary result URL availability.
- [x] 5.4 Add links from the appropriate repository/web entry points so examples, configuration guidance, and the Playground are discoverable without exposing secret values.

## 6. Verification and Integration

- [x] 6.1 Run the relevant `bun test` suites for examples, route, and Playground behavior with no live Provider credentials or network dependency.
- [x] 6.2 Run `bun run lint` and resolve new errors while leaving unrelated existing warnings unchanged.
- [x] 6.3 Run `bun run typecheck` across affected workspaces and verify strict/no-implicit-any boundaries for server and client contracts.
- [x] 6.4 Run `bun run build` and confirm the browser bundle contains no Provider credentials or server-only Provider construction imports.
- [x] 6.5 Run the repository formatter/check for all changed files, inspect the final diff, and confirm no durable storage, user-system, fallback, batch-generation, or new Provider SDK dependency was introduced.
