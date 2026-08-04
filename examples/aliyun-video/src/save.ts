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
}

export async function saveResult(
  content: readonly SaveableContent[],
  options: SaveResultOptions
): Promise<string> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replaceAll(":", "");
  const outputDir = join(process.cwd(), "output", date);
  await mkdir(outputDir, { recursive: true });

  const files: string[] = [];
  const errors: string[] = [];
  for (const [index, item] of content.entries()) {
    try {
      const bytes = item.base64
        ? Buffer.from(item.base64, "base64")
        : await download(item.url);
      const fileName = `${time}-${index}${extensionFor(item.mimeType)}`;
      await writeFile(join(outputDir, fileName), bytes);
      files.push(fileName);
    } catch (error) {
      errors.push(
        `${index}: ${error instanceof Error ? error.message : "save failed"}`
      );
    }
  }

  await writeFile(
    join(outputDir, `${time}-metadata.json`),
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

async function download(url: string | undefined): Promise<Uint8Array> {
  if (!url) throw new Error("result has no URL or base64 payload");
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`download failed with HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function extensionFor(mimeType: string | undefined): string {
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
    default:
      return ".png";
  }
}
