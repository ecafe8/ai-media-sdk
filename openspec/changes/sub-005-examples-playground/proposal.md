## Why

SUB-005 currently has no runnable SDK examples or visual way to exercise the generated-image flow. Add a small, copyable Node.js example surface and a controlled Web Playground now so Provider adapters can be manually verified without exposing credentials or creating a product console.

## What Changes

- Add an `examples/*` workspace area with minimal Node.js image-generation examples that call the unified SDK API.
- Add per-Provider `.env.example` files containing placeholders and clear required/optional variable documentation.
- Implement a controlled `apps/web` Playground with Provider/model selection, text-to-image and image-edit modes, prompt/reference-image inputs, loading/task states, and result metadata.
- Add a server-side Playground request boundary that reads Provider credentials only from server environment variables and returns stable, sanitized responses.
- Register Alibaba Bailian recommended model choices and show their generation/edit capability differences, including hiding `z-image-turbo` from edit mode.
- Add concise SDK usage, Provider capability, configuration, and example documentation.
- Do not add user accounts, billing, history, durable image storage, automatic fallback, batch generation, or browser-side Provider keys.

## Capabilities

### New Capabilities

- `examples-workspace`: Runnable Node.js examples for the first-party Provider packages.
- `provider-env-templates`: Safe `.env.example` templates and configuration guidance per Provider.
- `playground-api`: A server-only Web Playground request boundary for unified SDK calls and sanitized errors.
- `playground-form`: Responsive Provider/model, mode, prompt, and reference-image controls with capability-aware validation.
- `playground-result`: Submission, processing, success, failure, unconfigured, unsupported, and empty result states with preview and metadata.
- `sdk-usage-docs`: Discoverable documentation for SDK calls, Provider configuration, model capabilities, and examples.

### Modified Capabilities

<!-- No existing OpenSpec capability requirements change. The SDK/provider contracts remain owned by SUB-001 through SUB-004. -->

## Impact

- Adds `examples/*` workspaces and root workspace/package configuration.
- Extends `apps/web` with Playground components, server route(s), validation, and controlled runtime configuration.
- Adds or updates README/configuration documentation and Provider `.env.example` files.
- Uses existing `@ai-media/sdk`, `@ai-media/provider-*`, `@workspace/ui`, Next.js, React, Bun, and `bun:test`; no Provider SDK wrapper or persistent datastore is required.
