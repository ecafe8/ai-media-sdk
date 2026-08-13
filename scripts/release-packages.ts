import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface PackageManifest {
  name: string;
  version: string;
  private?: boolean;
  description?: string;
  main?: string;
  types?: string;
  files?: string[];
  exports?: Record<string, unknown>;
  publishConfig?: { access?: string };
  dependencies?: Record<string, string>;
}

export const ROOT = resolve(__dirname, "..");

/** Ordered release packages; SDK dependencies publish before providers. */
export const RELEASE_PACKAGE_DIRECTORIES = [
  "packages/ai-media-sdk",
  "packages/uploader",
  "packages/provider-azure-openai",
  "packages/provider-aliyun-bailian",
  "packages/provider-volcengine",
  "packages/provider-minimax",
] as const;

export function readManifest(directory: string): PackageManifest {
  return JSON.parse(
    readFileSync(resolve(ROOT, directory, "package.json"), "utf8")
  ) as PackageManifest;
}

export function isProvider(manifest: PackageManifest): boolean {
  return Boolean(manifest.dependencies?.["@ai-media/sdk"]);
}
