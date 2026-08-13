## Context

`@ai-media/provider-minimax` (MiniMax-H3, async V2 video API) is complete: one model id serves text-to-video (t2v), first/last-frame image-to-video (i2v), and reference-to-video (r2v) with reference images/videos/audios; the core SDK already carries `lastFrame`, `referenceVideos`, `referenceAudios`. Both playgrounds still gate video to Alibaba Bailian: `apps/web` rejects non-Aliyun video in `server.ts` and the site executor rejects it in `executeSiteRequest`. The web video workbench is flag-driven (one model id = one fixed mode), which does not fit a multi-scenario model. The web route also silently drops `ratio` today even though the form sends it.

## Goals / Non-Goals

**Goals:**

- Make MiniMax-H3 usable end-to-end in both playgrounds with correct credentials, registry projection, dispatch, and result rendering (result rendering is provider-agnostic and reused).
- Introduce a scenario selector for multi-scenario video models without disturbing the flag-driven HappyHorse flow.
- Fix the web route's silent `ratio` drop and extend accepted video inputs (last-frame URL, reference video/audio URL lists) with validation.
- Keep all provider-native parameter rules enforced by the provider adapter; playgrounds only shape inputs and options.

**Non-Goals:**

- Audio modality (reserved tab, no SDK entry points).
- Local upload of reference videos/audios (public URLs only, matching the video-edit precedent).
- MiniMax task cancellation UI.
- Server-side `callback_url` handling.

## Decisions

### Scenario selector keyed off a projected `videoScenarios` marker

`PlaygroundModel` (web) and `SiteModel` (site) gain an optional `videoScenarios?: readonly ("t2v" | "i2v" | "r2v")[]` set by the `fromMinimax` projector (`["t2v", "i2v", "r2v"]`). The video workbench shows a scenario selector only when a model declares more than one scenario; HappyHorse models declare nothing and keep the current flag-driven inputs. The selector state resets to `t2v` on model/provider change alongside the existing re-seed pattern. This avoids pseudo-model registry hacks (three fake model ids for one real id) and keeps the SDK registry the single source of truth.

Alternative considered: always-visible optional inputs with client-side exclusivity validation. Rejected: ambiguous UX and error-prone submissions; the scenario selector matches the Hailuo product experience.

### Scenario-driven inputs and parameter rules

- **t2v**: prompt required; ratio control visible without `adaptive` (options from the registry list minus `adaptive`); no media inputs.
- **i2v**: prompt required; first-frame input required (web: URL text input; site: `ImageSourceField` with upload); optional last-frame input of the same kind; ratio hidden (adapter forces `adaptive`).
- **r2v**: prompt required; reference image URLs required (web: comma/newline-separated textarea like today's r2v input; site: ordered `ImageListField`); optional reference video/audio URL text inputs (comma-separated, capped at the registry's 3/3); ratio visible including `adaptive`, defaulting to `adaptive`.

Switching scenario only changes which inputs render; each scenario submits exclusively its own fields, so the adapter's mutual-exclusivity validation is a backstop, not the primary UX path.

### Duration and ratio options become model-aware

`video-form-schema` gains `videoDurationOptions(model)`: MiniMax models get integers 4-15 (rendered as seconds), other models keep the existing `3/5/10/15` list. `videoRatioOptions(model, scenario?)` filters `adaptive` out for MiniMax t2v. Resolution options already derive from `supportedResolutions` (`768P`/`2K` for MiniMax) and need no change beyond projection.

### Web request pipeline: new fields and namespace branching

`PlaygroundRequest` gains `ratio?: string`, `lastFrameImageUrl?: string`, `referenceVideoUrls?: readonly string[]`, `referenceAudioUrls?: readonly string[]`. The route validates them (strings; public http(s) URLs) and forwards them — fixing the existing `ratio` drop, which also starts forwarding Aliyun r2v/t2v ratios. `executePlaygroundRequest` branches the video `providerOptions` namespace by provider: `aliyun` keeps `resolution/duration/audio_setting/watermark:false` (minus duration for video-edit), `minimax` sends `{ resolution, duration, ratio? }` where ratio is always sent for t2v, never for i2v, and optional for r2v (workbench passes the selected value). The Aliyun-only gate in `createProviderSelection` becomes a provider switch instantiating `createMiniMaxProvider(resolveMinimaxCredentials(...), { transport })`.

### Site execution: gate relaxation and namespace branching

`executeSiteRequest` replaces the Aliyun-only video gate with an allowlist (`aliyun-bailian` | `minimax`), instantiates through the existing `buildSiteProvider` (which gains a `minimax` branch with optional baseUrl), and dispatches via `(providerInstance as MiniMaxProvider).video(model)`. `buildVideoProviderOptions` branches per provider with the same namespace rules as web. `SiteGenerationRequest` gains `lastFrameImage?: ImageInput`, `referenceVideoUrls?`, `referenceAudioUrls?`; the executor maps them to `lastFrame` (via the same `toImageContent` mapping as the first frame) and URL lists for `referenceVideos`/`referenceAudios`.

### Credentials and endpoint safety

Web: `MINIMAX_API_KEY` (+ optional `MINIMAX_BASE_URL`) in the zod env schema; `resolveMinimaxCredentials` mirrors seedream precedence (BYO key → env) with baseUrl optional; BYO panel fields: apiKey required, baseUrl optional with a `https://api.minimax.io` default hint; client-side completeness = apiKey alone. Site key-store: same completeness rule; `DEFAULT_HOST_ALLOWLIST.minimax = [".minimax.io"]`; settings dialog renders a seedream-style card (API Key + optional Base URL with endpoint validation and custom-host confirmation).

### CORS risk handled like other providers

Browser CORS against `api.minimax.io` is not field-verified. The site already degrades CORS failures into the generic network error message; the settings dialog gains the same CORS hint treatment used for Aliyun. If real-key testing during implementation shows CORS is blocked, the site card copy will say so explicitly; the web Playground (server-mediated) is unaffected either way.

## Risks / Trade-offs

- [Risk] MiniMax API rejects browser CORS. → Web playground works regardless; site surfaces an actionable error and hint. Verify with a real key when available; document the outcome in the README.
- [Risk] Two divergent video forms (web URL-text inputs vs site upload widgets) drift over time. → Both share the same scenario contract (`videoScenarios`, same option helpers per app) and provider validation remains authoritative.
- [Trade-off] `ratio` now actually reaches Aliyun video requests, changing observable behavior for existing users (their selected ratio is honored). → This is the intended fix; defaults preserved.
- [Trade-off] Scenario selector is MiniMax-specific logic in shared workbenches. → Gated behind the `videoScenarios` projection; zero behavior change for flag-driven models, covered by registry tests.

## Migration Plan

1. Web server pipeline (config, credentials, registry, route, server dispatch) + tests.
2. Web workbench scenario UI + schema helpers + credentials panel.
3. Site key-store/provider-client/executor + registry/types + tests.
4. Site settings dialog, video workbench scenario UI, landing copy.
5. Full verification (`lint`, `typecheck`, `build`, `test`), site preview build, commit.
