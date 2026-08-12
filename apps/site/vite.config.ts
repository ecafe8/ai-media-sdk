import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "src");
const uiSrc = path.resolve(__dirname, "../../packages/ui/src");
const sdkSrc = path.resolve(__dirname, "../../packages/ai-media-sdk/src");
const aliyunSrc = path.resolve(
  __dirname,
  "../../packages/provider-aliyun-bailian/src"
);
const azureSrc = path.resolve(
  __dirname,
  "../../packages/provider-azure-openai/src"
);
const seedreamSrc = path.resolve(
  __dirname,
  "../../packages/provider-seedream/src"
);
const minimaxSrc = path.resolve(
  __dirname,
  "../../packages/provider-minimax/src"
);

/**
 * GitHub Pages project sites are served under `/<repo>/`. The single
 * `VITE_SITE_BASE` variable drives both the Vite asset base and (via
 * `import.meta.env.BASE_URL`) the Router basename, so the two can never
 * drift. Local dev always uses the root path.
 */
export default defineConfig(({ command }) => {
  const base =
    process.env.VITE_SITE_BASE ??
    (command === "serve" ? "/" : "/ai-media-sdk/");

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: [
        { find: "@", replacement: srcDir },
        {
          find: "@workspace/ui/globals.css",
          replacement: path.resolve(uiSrc, "styles/globals.css"),
        },
        {
          find: /^@workspace\/ui\/(.+)$/,
          replacement: `${uiSrc}/$1`,
        },
        {
          find: "@ai-media/sdk",
          replacement: path.resolve(sdkSrc, "index.ts"),
        },
        { find: /^@ai-media\/sdk\/(.+)$/, replacement: `${sdkSrc}/$1` },
        {
          find: "@ai-media/provider-aliyun-bailian",
          replacement: path.resolve(aliyunSrc, "index.ts"),
        },
        {
          find: /^@ai-media\/provider-aliyun-bailian\/(.+)$/,
          replacement: `${aliyunSrc}/$1`,
        },
        {
          find: "@ai-media/provider-azure-openai",
          replacement: path.resolve(azureSrc, "index.ts"),
        },
        {
          find: /^@ai-media\/provider-azure-openai\/(.+)$/,
          replacement: `${azureSrc}/$1`,
        },
        {
          find: "@ai-media/provider-seedream",
          replacement: path.resolve(seedreamSrc, "index.ts"),
        },
        {
          find: /^@ai-media\/provider-seedream\/(.+)$/,
          replacement: `${seedreamSrc}/$1`,
        },
        {
          find: "@ai-media/provider-minimax",
          replacement: path.resolve(minimaxSrc, "index.ts"),
        },
        {
          find: /^@ai-media\/provider-minimax\/(.+)$/,
          replacement: `${minimaxSrc}/$1`,
        },
      ],
    },
    build: { outDir: "dist" },
    server: { port: 5174 },
  };
});
