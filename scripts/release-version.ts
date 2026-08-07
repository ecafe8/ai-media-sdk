import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface PackageManifest {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
}

const ROOT = resolve(__dirname, "..");
const PACKAGE_DIRECTORIES = [
  "packages/ai-media-sdk",
  "packages/uploader",
  "packages/provider-azure-openai",
  "packages/provider-aliyun-bailian",
  "packages/provider-seedream",
];
const PROVIDER_PACKAGE_NAMES = new Set([
  "@ai-media/provider-azure-openai",
  "@ai-media/provider-aliyun-bailian",
  "@ai-media/provider-seedream",
]);

function readManifest(directory: string): PackageManifest {
  return JSON.parse(
    readFileSync(resolve(ROOT, directory, "package.json"), "utf8")
  ) as PackageManifest;
}

function writeManifest(directory: string, manifest: PackageManifest): void {
  writeFileSync(
    resolve(ROOT, directory, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

function parseVersion(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Invalid semver version: ${version}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function resolveVersion(
  currentVersion: string,
  requestedVersion?: string
): string {
  const [major, minor, patch] = parseVersion(currentVersion);
  if (!requestedVersion || requestedVersion === "patch") {
    return `${major}.${minor}.${patch + 1}`;
  }
  if (requestedVersion === "minor") return `${major}.${minor + 1}.0`;
  if (requestedVersion === "major") return `${major + 1}.0.0`;

  parseVersion(requestedVersion);
  return requestedVersion;
}

function main(): void {
  const requestedVersion = process.argv[2];
  const manifests = PACKAGE_DIRECTORIES.map((directory) => ({
    directory,
    manifest: readManifest(directory),
  }));
  const sdk = manifests.find(
    ({ manifest }) => manifest.name === "@ai-media/sdk"
  );
  if (!sdk) throw new Error("@ai-media/sdk package was not found");

  const version = resolveVersion(sdk.manifest.version, requestedVersion);
  for (const { directory, manifest } of manifests) {
    manifest.version = version;
    if (PROVIDER_PACKAGE_NAMES.has(manifest.name)) {
      manifest.dependencies = {
        ...manifest.dependencies,
        "@ai-media/sdk": `^${version}`,
      };
    }
    writeManifest(directory, manifest);
  }

  console.log(`Updated ${manifests.length} packages to ${version}`);
  console.log("Review the changes with: git diff -- packages/*/package.json");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
