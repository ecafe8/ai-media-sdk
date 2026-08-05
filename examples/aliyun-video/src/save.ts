import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface SaveableContent {
  readonly url?: string;
  readonly base64?: string;
  readonly mimeType?: string;
}

export interface SaveResultOptions {
  readonly provider: string;
  readonly model: string;
  readonly requestId?: string;
  readonly prompt: string;
  readonly startedAt: number;
  readonly runId: string;
}

export async function saveResult(
  content: readonly SaveableContent[],
  options: SaveResultOptions
): Promise<string> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const outputDir = join(
    process.cwd(),
    "output",
    date,
    `${options.runId}-${safeName(options.model)}`
  );
  await mkdir(outputDir, { recursive: true });

  const files: string[] = [];
  const errors: string[] = [];
  for (const [index, item] of content.entries()) {
    try {
      const bytes = item.base64
        ? Buffer.from(item.base64, "base64")
        : await download(item.url);
      const fileName = `${index}${extensionFor(item.mimeType, item.url)}`;
      await writeFile(join(outputDir, fileName), bytes);
      files.push(fileName);
    } catch (error) {
      errors.push(
        `${index}: ${error instanceof Error ? error.message : "save failed"}`
      );
    }
  }

  await writeFile(
    join(outputDir, "metadata.json"),
    JSON.stringify(
      {
        timestamp: now.toISOString(),
        provider: options.provider,
        model: options.model,
        requestId: options.requestId,
        prompt: options.prompt,
        durationMs: Date.now() - options.startedAt,
        files,
        ...(errors.length > 0 ? { errors } : {}),
      },
      null,
      2
    )
  );

  return outputDir;
}

export async function saveBatchSummary(
  results: readonly Record<string, unknown>[],
  prompt: string,
  startedAt: number
): Promise<string> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replaceAll(":", "");
  const outputDir = join(process.cwd(), "output", date);
  await mkdir(outputDir, { recursive: true });
  const filePath = join(outputDir, `${time}-batch-summary.json`);
  await writeFile(
    filePath,
    JSON.stringify(
      {
        timestamp: now.toISOString(),
        prompt,
        durationMs: Date.now() - startedAt,
        results,
      },
      null,
      2
    )
  );
  return filePath;
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

async function download(url: string | undefined): Promise<Uint8Array> {
  if (!url) throw new Error("result has no URL or base64 payload");
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`download failed with HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function extensionFor(mimeType: string | undefined, url?: string): string {
  switch (mimeType?.toLowerCase()) {
    case "video/mp4":
      return ".mp4";
    case "video/webm":
      return ".webm";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/png":
      return ".png";
  }

  // Provider result URLs are often signed, so inspect only the pathname.
  if (url) {
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      if (pathname.endsWith(".mp4")) return ".mp4";
      if (pathname.endsWith(".webm")) return ".webm";
      if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
        return ".jpg";
      }
      if (pathname.endsWith(".webp")) return ".webp";
      if (pathname.endsWith(".png")) return ".png";
    } catch {
      // Fall through to the video example's safe default.
    }
  }

  return ".mp4";
}
