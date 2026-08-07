import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

interface PackageManifest {
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

const ROOT = resolve(import.meta.dir, "..");
const PACKAGES: string[] = [
  "packages/ai-media-sdk",
  "packages/uploader",
  "packages/provider-azure-openai",
  "packages/provider-aliyun-bailian",
  "packages/provider-seedream",
];
const REQUIRED_FILES = ["package.json", "README.md"];
const FORBIDDEN_PATTERNS = [
  /\.env($|\.)/,
  /node_modules/,
  /(^|\/)src\//,
  /\.test\./,
];

function run(command: string, args: string[]): void {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${result.status ?? "unknown"}`
    );
  }
}

function readManifest(packageDirectory: string): PackageManifest {
  const path = resolve(ROOT, packageDirectory, "package.json");
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

function validateManifest(
  packageDirectory: string,
  manifest: PackageManifest
): void {
  const errors: string[] = [];

  if (manifest.private) errors.push("must not be private");
  if (!manifest.name.startsWith("@ai-media/"))
    errors.push("must use @ai-media scope");
  if (!manifest.version || manifest.version === "0.0.0")
    errors.push("must have a release version");
  if (!manifest.description) errors.push("must have a description");
  if (manifest.publishConfig?.access !== "public")
    errors.push("must set publishConfig.access to public");
  if (!manifest.files?.includes("dist")) errors.push("files must include dist");
  if (!manifest.main || !manifest.types || !manifest.exports)
    errors.push("must define main, types, and exports");

  for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
    if (version.startsWith("workspace:"))
      errors.push(`dependency ${name} still uses workspace protocol`);
  }

  if (errors.length > 0) {
    throw new Error(`${packageDirectory}: ${errors.join("; ")}`);
  }
}

function checkPackedFiles(
  packageDirectory: string,
  manifest: PackageManifest
): void {
  const result = spawnSync(
    "npm",
    ["pack", "--dry-run", "--json", `--workspace=${manifest.name}`],
    {
      cwd: ROOT,
      encoding: "utf8",
    }
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`${packageDirectory}: npm pack --dry-run failed`);
  }

  const output = JSON.parse(result.stdout) as Array<{
    files?: Array<{ path: string }>;
  }>;
  const files = output[0]?.files?.map((file) => file.path) ?? [];
  const errors = REQUIRED_FILES.filter((file) => !files.includes(file));

  if (!files.some((file) => file.startsWith("dist/") && file.endsWith(".js"))) {
    errors.push("dist/**/*.js");
  }
  if (
    !files.some((file) => file.startsWith("dist/") && file.endsWith(".d.ts"))
  ) {
    errors.push("dist/**/*.d.ts");
  }

  const forbiddenFiles = files.filter((file) =>
    FORBIDDEN_PATTERNS.some((pattern) => pattern.test(file))
  );
  if (forbiddenFiles.length > 0)
    errors.push(`forbidden files: ${forbiddenFiles.join(", ")}`);
  if (errors.length > 0) {
    throw new Error(
      `${packageDirectory}: invalid pack contents: ${errors.join(", ")}`
    );
  }

  const size = output[0]?.size ?? 0;
  console.log(
    `✓ ${manifest.name}@${manifest.version}: ${files.length} files, ${size} bytes`
  );
  if (process.argv.includes("--pack"))
    run("npm", ["pack", `--workspace=${manifest.name}`]);
}

function main(): void {
  for (const packageDirectory of PACKAGES) {
    const manifest = readManifest(packageDirectory);
    validateManifest(packageDirectory, manifest);
    if (!existsSync(resolve(ROOT, packageDirectory, "README.md"))) {
      throw new Error(packageDirectory + ": README.md is missing");
    }
  }

  run("bun", ["run", "lint"]);
  for (const packageDirectory of PACKAGES) {
    run("bun", ["run", "--cwd", packageDirectory, "typecheck:release"]);
  }
  run("bun", ["run", "build"]);
  run("bun", ["run", "test"]);

  for (const packageDirectory of PACKAGES) {
    checkPackedFiles(packageDirectory, readManifest(packageDirectory));
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
