import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

interface PackageManifest {
  name: string;
  version: string;
}

interface ReleaseOptions {
  dryRun: boolean;
  push: boolean;
  tag: string;
}

const ROOT = resolve(__dirname, "..");
const PACKAGE_DIRECTORIES = [
  "packages/ai-media-sdk",
  "packages/uploader",
  "packages/provider-azure-openai",
  "packages/provider-aliyun-bailian",
  "packages/provider-seedream",
];
const PACKAGE_JSON_PATHS = PACKAGE_DIRECTORIES.map(
  (directory) => `${directory}/package.json`
);

function readManifest(directory: string): PackageManifest {
  return JSON.parse(
    readFileSync(resolve(ROOT, directory, "package.json"), "utf8")
  ) as PackageManifest;
}

function run(command: string, args: string[], inherit = true): string {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe",
  });

  if (result.status !== 0) {
    const details = inherit ? "" : `\n${result.stderr.trim()}`;
    throw new Error(
      `Command failed with exit code ${result.status ?? "unknown"}.${details}`
    );
  }
  return inherit ? "" : result.stdout.trim();
}

function parseOptions(): ReleaseOptions {
  const args = process.argv.slice(2);
  const tagIndex = args.indexOf("--tag");
  const tag = tagIndex >= 0 ? args[tagIndex + 1] : "latest";

  if (tagIndex >= 0 && !tag) throw new Error("--tag requires a value");
  const unknown = args.filter(
    (arg, index) =>
      !["--dry-run", "--push", "--tag"].includes(arg) &&
      !(tagIndex >= 0 && index === tagIndex + 1)
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown release option: ${unknown.join(", ")}`);
  }

  return {
    dryRun: args.includes("--dry-run"),
    push: args.includes("--push"),
    tag: tag ?? "latest",
  };
}

function assertVersionConsistency(): string {
  const manifests = PACKAGE_DIRECTORIES.map(readManifest);
  const versions = new Set(manifests.map((manifest) => manifest.version));
  if (versions.size !== 1) {
    throw new Error(
      `All release packages must use one version: ${manifests
        .map((manifest) => `${manifest.name}=${manifest.version}`)
        .join(", ")}`
    );
  }

  const version = manifests[0]?.version;
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid release version: ${version ?? "missing"}`);
  }
  return version;
}

function assertWorktree(): void {
  const status = run("git", ["status", "--porcelain"], false);
  const unexpected = status
    .split("\n")
    .filter(Boolean)
    .filter((line) => !PACKAGE_JSON_PATHS.some((path) => line.endsWith(path)));

  if (unexpected.length > 0) {
    throw new Error(
      "Working tree contains unexpected changes. Commit or stash them before release:\n" +
        unexpected.join("\n")
    );
  }
}

function publish(manifests: PackageManifest[], options: ReleaseOptions): void {
  for (const manifest of manifests) {
    const args = [
      "publish",
      `--workspace=${manifest.name}`,
      "--access",
      "public",
      "--tag",
      options.tag,
    ];
    if (options.dryRun) args.push("--dry-run");
    run("npm", args);
  }
}

function verifyRegistry(manifests: PackageManifest[], tag: string): void {
  for (const manifest of manifests) {
    const spec = `${manifest.name}@${manifest.version}`;
    const result = run("npm", ["view", spec, "version", "--json"], false);
    const publishedVersion = JSON.parse(result) as string;
    if (publishedVersion !== manifest.version) {
      throw new Error(
        `${spec} resolved to ${publishedVersion}, not ${manifest.version}`
      );
    }
    console.log(`✓ ${spec} is available on npm (${tag})`);
  }
}

function commitAndTag(version: string): void {
  const tag = `v${version}`;
  const existingTag = run("git", ["tag", "--list", tag], false);
  if (existingTag === tag) throw new Error(`Git tag already exists: ${tag}`);

  run("git", ["add", ...PACKAGE_JSON_PATHS]);
  run("git", ["commit", "-m", `chore: release ${tag}`]);
  run("git", ["tag", "-a", tag, "-m", `Release ${tag}`]);
}

function main(): void {
  const options = parseOptions();
  const version = assertVersionConsistency();
  assertWorktree();

  console.log(
    `${options.dryRun ? "Dry-run" : "Release"} ${version} using npm tag ${options.tag}`
  );
  run("bun", ["run", "release:check"]);

  const manifests = PACKAGE_DIRECTORIES.map(readManifest);
  publish(manifests, options);
  if (options.dryRun) {
    console.log(
      "Dry-run complete; no packages, commit, tag, or push were changed."
    );
    return;
  }

  verifyRegistry(manifests, options.tag);
  commitAndTag(version);

  if (options.push) {
    run("git", ["push", "origin", "main"]);
    run("git", ["push", "origin", `v${version}`]);
  } else {
    console.log(
      `Release committed and tagged locally. Push with: git push origin main v${version}`
    );
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
