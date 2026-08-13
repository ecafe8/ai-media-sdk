## Why

The MiniMax provider (`@ai-media/provider-minimax`, MiniMax-H3 async video) is implemented and released inside the SDK, but neither Playground can use it: the web Playground hard-gates video to Alibaba Bailian, and the site's BYO-key executor rejects every non-Aliyun video request. Visitors cannot experience MiniMax-H3's text-to-video, first/last-frame image-to-video, or reference-to-video (images/videos/audios) scenarios.

## What Changes

- Add `minimax` as a Provider in the web Playground: env configuration (`MINIMAX_API_KEY`/optional `MINIMAX_BASE_URL`), credential resolution (server + BYO key), registry projection from `MINIMAX_MODEL_REGISTRY`, API route acceptance, and server-side dispatch building `providerOptions.minimax`.
- Add MiniMax to the site BYO-key playground: key-store provider entry with `.minimax.io` endpoint allowlist, settings-dialog credential card, `buildSiteProvider` branch, and executor video dispatch with the `minimax` options namespace.
- Introduce a scenario selector for single-model multi-scenario video models: MiniMax-H3 exposes 文生视频 / 图生视频（首帧 + 可选尾帧）/ 参考生视频（参考图/视频/音频 URL） from one model id; the selector drives which inputs and parameter rules the form shows. Flag-driven HappyHorse models keep their current behavior unchanged.
- Carry new video inputs end-to-end: `ratio` (currently dropped by the web route), last-frame image, ordered reference video URLs, and ordered reference audio URLs; the web route validates them as public http(s) URLs.
- Make video duration options model-aware (MiniMax: 4-15 seconds; HappyHorse keeps 3/5/10/15) and apply MiniMax ratio semantics per scenario (t2v requires a concrete ratio, i2v hides ratio, r2v defaults to adaptive).
- Update both playgrounds' tests (registry projections, credential rules, route validation, executor gating) and the landing page provider copy.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `playground-api`: Accept `minimax` requests; validate and forward `ratio`, last-frame image URL, reference video/audio URL lists; derive the model list from the MiniMax registry in addition to the existing registries.
- `playground-form`: Expose the MiniMax-H3 scenario selector with scenario-driven inputs, validation, and parameter rules.
- `byo-key-store`: Define the MiniMax credential field set (apiKey; optional baseUrl) and completeness rules.
- `direct-provider-execution`: Replace the Aliyun-only video gate with Aliyun + MiniMax video execution and provider-specific option namespaces.
- `playground-media-input`: Add the i2v last-frame image field and r2v reference video/audio URL fields driven by the MiniMax scenario selector.
- `site-shell`: Landing page provider copy and model matrix include MiniMax.

## Impact

- `apps/web`: playground types/registry/server/provider-credentials, generate route, credentials panel + credentials lib, video workbench + video-form-schema, env schema, `next.config.ts` transpile list, package dependency, `.env.example`, tests.
- `apps/site`: key-store, provider-client, executor, playground registry/types, settings dialog, video workbench + video-form-schema, landing copy, vite/tsconfig alias wiring, package dependency, tests.
- No changes to `packages/ai-media-sdk` or `packages/provider-minimax` behavior; both playgrounds consume the existing contracts (`submitVideoTask`, `lastFrame`, `referenceVideos`, `referenceAudios`, `providerOptions.minimax`).
- Browser CORS against `api.minimax.io` is not yet field-verified; the site integration ships with the same endpoint-confirmation safeguards as other providers and an actionable CORS failure message.
