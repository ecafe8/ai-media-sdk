## Context

The repository already contains the shared Next.js web shell and UI package, plus the SDK and Provider contracts delivered by earlier phases. It does not yet contain `examples/*`, Provider environment templates, or a useful Playground. SUB-005 must connect those existing contracts without turning `apps/web` into a public console.

The target interaction is a two-pane developer tool similar to the supplied reference: a compact configuration panel on the left and a scrollable generation feed on the right. Desktop uses the split view; mobile stacks the form before the results. The browser submits only non-secret inputs to a Next.js server boundary.

## Goals / Non-Goals

**Goals:**

- Provide copyable Node.js examples for each currently supported first-party Provider.
- Provide safe, self-documenting `.env.example` files and a configuration status model.
- Provide a responsive controlled Playground for text-to-image and supported image editing.
- Keep Provider construction, SDK calls, and secret handling on the server.
- Make capability differences and task/result/error states visible and testable.
- Reuse `@workspace/ui`, existing theme/global styles, and the unified SDK contracts.

**Non-Goals:**

- No authentication, multi-tenant access control, billing, quotas, history, or durable storage.
- No browser-side Provider calls or API-key input.
- No automatic fallback, batch generation, task recovery after refresh, or public API guarantee.
- No new Provider SDK wrapper and no changes to SDK core/provider contracts owned by SUB-001 through SUB-004.

## Decisions

### D1: Keep examples as independent workspace applications

Each Provider example lives under `examples/<provider>-image/` with its own `package.json`, entrypoint, and `.env.example`, and imports the published/workspace SDK packages. The examples use one conservative request and one output path rather than a shared example framework.

This favors copyability and Provider isolation over deduplicating a small amount of script code. Shared abstractions would make the examples less useful as contract smoke tests.

### D2: Use a server-only Next route as the Playground boundary

The web client posts to a single internal route such as `POST /api/playground/generate`. The route validates provider, model, mode, prompt, and optional reference-image input, resolves a server-side Provider from environment configuration, calls the unified SDK, and returns a stable result envelope. It never accepts a credential field.

The route is preferred over Server Actions because it gives the examples and future non-React clients a clear JSON boundary and makes request/response tests straightforward. It remains an internal Playground contract, not a versioned public API.

### D3: Use a typed capability registry for form options

The server and client consume a shared, non-secret registry describing Provider/model labels, configured status, generation/edit support, allowed image inputs, and recommended use case. The registry is the source of truth for filtering edit-capable models. Alibaba recommendations are represented explicitly: `wan2.7-image-pro` for quality, `wan2.7-image` for balanced use, and `z-image-turbo` for speed/cost; `z-image-turbo` is not edit-capable.

The registry is preferable to inferring capabilities from user input or hardcoding an "all models support edit" assumption. Server validation repeats the capability check because client filtering is not an authorization boundary.

### D4: Start with URL-based reference images

The first implementation accepts a constrained public/reference URL for edit mode. The form exposes the reference-image field only when the selected model supports editing, and the server validates URL shape and input count. Multipart upload is deferred until its size, MIME, temporary-file, and cleanup policy are decided.

This keeps the initial Playground stateless and avoids adding an image-processing or temporary-file dependency while preserving the unified `ImageContent` input contract.

### D5: Return a stable, sanitized result envelope

The route returns `status` (`succeeded`, `processing`, or `failed`), result image references, non-sensitive metadata, and a stable error `code`/safe `message` when applicable. Provider response bodies, stack traces, credentials, authorization headers, and raw prompts/images are not returned or logged by default.

The UI maps the envelope to explicit empty, loading, processing, success, unsupported, unconfigured, and failure states. It does not invent Provider-specific retry or fallback behavior.

### D6: Build the UI as a focused two-pane workspace

The page keeps a left control panel with tabs/mode selection, Provider/model fields, prompt, optional reference image, size/aspect/output-count controls, example prompt chips, and a primary Generate button. The right side displays a feed of result cards with status, prompt summary, metadata chips, preview placeholders, and image URLs when available.

This matches the supplied testing reference while retaining accessible labels, keyboard focus, text status, and a single-column mobile layout. Existing shared components are reused; missing primitives are added only when required.

### D7: Test without live Provider calls

Examples are smoke-tested for missing configuration and request construction. The route and UI use mocked SDK/provider boundaries for deterministic tests; real network generation is an explicit opt-in local operation. Verification remains `lint`, `typecheck`, `build`, and `bun test` where test files exist, with no invented root test script.

## Risks / Trade-offs

- **[Controlled deployment can be exposed accidentally]** -> Document local/controlled use, bind configuration to server environment, reject credentials from requests, and leave authentication/rate limiting as deployment responsibilities.
- **[Remote image URLs may be unavailable or unsafe]** -> Validate URL input and Provider capability before dispatch; defer arbitrary URL fetching/upload support until a bounded download and cleanup policy exists.
- **[Provider result URLs may expire]** -> Label previews as temporary and do not promise persistence or history.
- **[SDK/provider contracts may still evolve]** -> Keep the route adapter thin, use public contracts only, and cover mapping with mocks rather than duplicating Provider logic.
- **[Existing shared UI primitives may be incomplete]** -> Inspect and reuse current components, adding the smallest package-local primitives needed for accessible form and status presentation.

## Migration Plan

1. Add workspace/example metadata and `.env.example` files without changing existing package behavior.
2. Implement the server registry and route with mocked contract tests.
3. Replace the current web starter page with the responsive Playground and UI state tests.
4. Add usage/configuration documentation and run `lint`, `typecheck`, `build`, and relevant `bun test` commands.
5. Roll back by removing the new examples/route/UI change; existing SDK and Provider packages remain independently usable.

## Open Questions

- Whether the controlled Playground needs a deployment-level access gate beyond local-only documentation.
- Whether the next slice should add constrained multipart upload in addition to URL references.
- Whether the Playground language should be Chinese, English, or follow a future localization decision; this slice uses one consistent language.
