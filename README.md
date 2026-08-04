# AI Media SDK

多 Provider 多模态生成 SDK（图像 + 视频）。基于 Bun + Turborepo monorepo，UI 使用 shadcn/ui。详见 `docs/prd/`。

## SDK Examples

The runnable Provider examples live under `examples/`. Copy the matching
`.env.example` to `.env` in that example directory, fill in server-side
credentials, then run one request:

```bash
bun install
cp examples/azure-image/.env.example examples/azure-image/.env
bun run --cwd examples/azure-image start

cp examples/aliyun-bailian-image/.env.example examples/aliyun-bailian-image/.env
bun run --cwd examples/aliyun-bailian-image start

cp examples/aliyun-video/.env.example examples/aliyun-video/.env
bun run --cwd examples/aliyun-video start
```

Both image examples submit one image request with one output by default. A prompt can
be passed as command-line text. Missing environment variables fail before any
network request, and errors are printed without credentials or raw Provider
responses.

The Alibaba image example defaults to `qwen-image-2.0-pro`, which supports generation
and editing. The recommended Wan models are `wan2.7-image-pro` for quality and
`wan2.7-image` for balanced generation. `z-image-turbo` is a fast,
generation-only model and is not offered for editing.

### Video examples

The Alibaba video example supports four HappyHorse modes via
`ALIYUN_BAILIAN_VIDEO_MODEL`:

- `happyhorse-1.1-t2v` — text-to-video (prompt only).
- `happyhorse-1.1-i2v` — first-frame image-to-video (one image URL).
- `happyhorse-1.1-r2v` — reference-to-video (1-9 reference image URLs; use
  `[Image N]` in the prompt to refer to each image by order).
- `happyhorse-1.0-video-edit` — source video editing (one public `http:`/`https:`
  video URL + 0-5 optional reference image URLs; supports `audio_setting`
  `auto`/`origin`; does not accept `ratio` or `duration`).

r2v and video-edit inputs are provided via environment variables:

- `ALIYUN_BAILIAN_REFERENCE_IMAGE_URLS` — comma-separated reference image URLs.
- `ALIYUN_BAILIAN_INPUT_VIDEO_URL` — public source video URL (not base64 or
  local file).

Task IDs and result URLs expire after 24 hours; the caller is responsible for
downloading and persisting results.

## Controlled Web Playground

Run `bun run dev` and open `http://localhost:3000`. The Playground is a
controlled developer tool, not a public multi-tenant service. Its browser only
sends prompt and model parameters to the Next.js server route; Provider API
keys are read from server environment variables and never enter the browser.

The UI supports text-to-image for configured Providers and URL-based reference
images for models whose capability registry supports editing. Video modes
(t2v/i2v/r2v/video-edit) are available for configured Aliyun models. Results are
temporary remote previews. Prompts, images, tasks, and results are not stored
as history.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
bunx --bun shadcn@latest add button --cwd packages/ui
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/shadcn/button";
```
