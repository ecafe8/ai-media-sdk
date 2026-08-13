## 1. Web Playground Server Pipeline

- [x] 1.1 Add `MINIMAX_API_KEY`/`MINIMAX_BASE_URL` to the zod env schema and document them in `apps/web/.env.example`.
- [x] 1.2 Extend playground types: `minimax` provider id, `minimax-h3-video` family slug, and request fields `ratio`/`lastFrameImageUrl`/`referenceVideoUrls`/`referenceAudioUrls`; add `videoScenarios`/reference video/audio caps to `PlaygroundModel`.
- [x] 1.3 Add `resolveMinimaxCredentials`, the env-configured case, and credential tests.
- [x] 1.4 Project `MINIMAX_MODEL_REGISTRY` in the playground registry (provider entry, labels, `fromMinimax` with resolution/ratio allowlists, caps, `videoScenarios`) and extend registry tests.
- [x] 1.5 Accept `minimax` in the generate route; validate and forward `ratio`/last-frame/reference video/audio URL fields; extend route tests.
- [x] 1.6 Replace the Aliyun-only video gate in `server.ts` with a provider switch and branch `providerOptions` namespaces (`aliyun` vs `minimax`) including `lastFrame`/`referenceVideos`/`referenceAudios` forwarding.

## 2. Web Playground Scenario UI

- [x] 2.1 Extend `video-form-schema` with model-aware duration options (MiniMax 4-15), scenario-aware ratio options (no `adaptive` for MiniMax t2v), and scenario visibility helpers.
- [x] 2.2 Add the scenario selector and scenario-driven inputs (first/last frame URLs, reference image/video/audio URL lists) to the video workbench with Chinese validation messages and scenario-exclusive submission.
- [x] 2.3 Add MiniMax credential field specs to the credentials panel and completeness rule to the credentials lib; extend credentials tests.
- [x] 2.4 Add `@ai-media/provider-minimax` to `apps/web` dependencies and `next.config.ts` transpile list; run `bun install`.

## 3. Site BYO-Key Foundation

- [x] 3.1 Add `minimax` to the site key-store (provider list, labels, apiKey-only completeness, `.minimax.io` allowlist, missing-field labels) and extend key-store tests.
- [x] 3.2 Add the `buildSiteProvider` minimax branch (optional baseUrl) and extend the provider union type.
- [x] 3.3 Relax the executor video gate to Aliyun + MiniMax, branch `buildVideoProviderOptions` per namespace, and forward `lastFrame`/`referenceVideos`/`referenceAudios`; extend executor tests (minimax video no longer rejected, unconfigured minimax blocked locally).
- [x] 3.4 Extend site playground types (`minimax-h3-video` family, `videoScenarios`, reference caps, new request fields) and project MiniMax in the site registry; update registry tests including the aliyun-only video assertion.

## 4. Site UI Integration

- [x] 4.1 Add the MiniMax card to the settings dialog (draft init, apiKey + optional baseUrl validation with custom-host confirmation, configured badge, field rendering).
- [x] 4.2 Add the scenario selector and scenario-driven inputs to the site video workbench (first/last frame via image source fields, reference images via the ordered list, reference video/audio URL inputs) with model-aware duration/ratio options.
- [x] 4.3 Update landing page provider copy to include MiniMax.
- [x] 4.4 Add `@ai-media/provider-minimax` to site dependencies, vite alias, and tsconfig paths; run `bun install`.

## 5. Verification

- [x] 5.1 Run `bun run lint`, `bun run typecheck`, `bun run build`, and `bun run test`.
- [x] 5.2 Verify the site Pages build locally (`bun run site:preview` smoke check).
- [x] 5.3 Review the final diff, stage only intended files, and commit on the current branch.
