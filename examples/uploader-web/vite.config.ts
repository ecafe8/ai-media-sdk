import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

import { uploadApiPlugin } from "./server/upload-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "src");
const uiSrc = path.resolve(__dirname, "../../packages/ui/src");
const uploaderSrc = path.resolve(__dirname, "../../packages/uploader/src");

export default defineConfig(({ mode }) => {
  // Vite loads .env files, but does not copy non-VITE_* variables into
  // process.env. Pass the server-only keys explicitly to the middleware.
  const env = loadEnv(mode, __dirname, "");

  return {
    plugins: [react(), uploadApiPlugin(env) as Plugin],
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
          find: "@ai-media/uploader",
          replacement: path.resolve(uploaderSrc, "index.ts"),
        },
        {
          find: /^@ai-media\/uploader\/(.+)$/,
          replacement: `${uploaderSrc}/$1`,
        },
      ],
    },
    build: { outDir: "dist" },
    server: { port: 5173 },
  };
});
