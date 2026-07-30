# AI Media SDK

多 Provider 多模态生成 SDK（MVP 聚焦图像）。基于 Bun + Turborepo monorepo，UI 使用 shadcn/ui。详见 `docs/prd/`。

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
```

Both examples submit one image request with one output by default. A prompt can
be passed as command-line text. Missing environment variables fail before any
network request, and errors are printed without credentials or raw Provider
responses.

The Alibaba example defaults to `qwen-image-2.0-pro`, which supports generation
and editing. The recommended Wan models are `wan2.7-image-pro` for quality and
`wan2.7-image` for balanced generation. `z-image-turbo` is a fast,
generation-only model and is not offered for editing.

## Controlled Web Playground

Run `bun run dev` and open `http://localhost:3000`. The Playground is a
controlled developer tool, not a public multi-tenant service. Its browser only
sends prompt and model parameters to the Next.js server route; Provider API
keys are read from server environment variables and never enter the browser.

The UI supports text-to-image for configured Providers and URL-based reference
images for models whose capability registry supports editing. Results are
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
