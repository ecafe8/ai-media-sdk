import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  isProvider,
  type PackageManifest,
  RELEASE_PACKAGE_DIRECTORIES,
  ROOT,
  readManifest,
} from "./release-packages.ts";

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
  const manifests = RELEASE_PACKAGE_DIRECTORIES.map((directory) => ({
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
    if (isProvider(manifest)) {
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
