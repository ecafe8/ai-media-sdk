/**
 * Post-build step: create the SPA deep-link fallback document and mirror the
 * entry document plus assets under the asset base path.
 *
 * GitHub Pages serves `404.html` for unknown paths; copying `index.html`
 * there lets the client router take over deep links such as
 * `/<repo>/playground`. A custom domain mounts the same artifact at the root
 * path while the HTML keeps absolute asset URLs like `/<repo>/assets/...`,
 * so the entry and `assets/` are also mirrored into `dist/<repo>/` to stay
 * resolvable on both mounts. Verifies both documents exist and that all
 * absolute asset references share the same base path.
 */
import { copyFile, cp, mkdir, readFile, stat } from "node:fs/promises";
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

const basePrefix = absoluteAssetUrls
  .map((url) => /^\/(.+)\/assets\//.exec(url)?.[1])
  .find((value): value is string => value !== undefined);

if (basePrefix) {
  const mirrorDir = path.join(distDir, basePrefix);
  await mkdir(mirrorDir, { recursive: true });
  await cp(sourcePath, path.join(mirrorDir, "index.html"));
  await cp(path.join(distDir, "assets"), path.join(mirrorDir, "assets"), {
    recursive: true,
  });
  await stat(path.join(mirrorDir, "index.html"));
  await stat(path.join(mirrorDir, "assets"));
}

console.log(
  `postbuild: 404.html created; ${absoluteAssetUrls.length} absolute asset reference(s) share one base path${basePrefix ? `; mirrored under /${basePrefix}/` : ""}`
);
