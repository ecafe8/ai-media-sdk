# AI Media SDK

多 Provider 多模态生成 SDK（MVP 聚焦图像）。基于 Bun + Turborepo monorepo，UI 使用 shadcn/ui。详见 `docs/prd/`。

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/shadcn/button";
```
