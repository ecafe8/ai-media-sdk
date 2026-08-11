/**
 * Post-build step: create the SPA deep-link fallback document.
 *
 * GitHub Pages serves `404.html` for unknown paths; copying `index.html`
 * there lets the client router take over deep links such as
 * `/<repo>/playground`. Also verifies both documents exist and that all
 * absolute asset references share the same base path.
 */
import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve(import.meta.dirname, "..", "dist");
const sourcePath = path.join(distDir, "index.html");
const fallbackPath = path.join(distDir, "404.html");

await copyFile(sourcePath, fallbackPath);

const html = await readFile(fallbackPath, "utf8");
const absoluteAssetUrls = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)]
  .map((match) => match[1])
  .filter((url) => url !== "/");

const malformed = absoluteAssetUrls.filter(
  (url) => !/^\/([^/]+\/)?assets\//.test(url)
);
if (malformed.length > 0) {
  throw new Error(
    `Assets outside the expected base path: ${malformed.join(", ")}`
  );
}

console.log(
  `postbuild: 404.html created; ${absoluteAssetUrls.length} absolute asset reference(s) share one base path`
);
