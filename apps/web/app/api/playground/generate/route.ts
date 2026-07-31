import { NextResponse } from "next/server";

import { executePlaygroundRequest } from "@/lib/playground/server";
import type { PlaygroundRequest } from "@/lib/playground/types";

const PROVIDERS = new Set([
  "azure-openai",
  "aliyun-bailian",
  "doubao-seedream",
]);
const MODES = new Set(["generate", "edit", "video"]);

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json();
    const input = validateRequest(body);
    if (!input) {
      return NextResponse.json(
        {
          status: "failed",
          error: {
            code: "VALIDATION_ERROR",
            message: "Provide a Provider, model, mode, and non-empty prompt.",
          },
        },
        { status: 422 }
      );
    }
    const result = await executePlaygroundRequest(input);
    return NextResponse.json(result, { status: result.error ? 422 : 200 });
  } catch {
    return NextResponse.json(
      {
        status: "failed",
        error: {
          code: "VALIDATION_ERROR",
          message: "The request body is invalid.",
        },
      },
      { status: 400 }
    );
  }
}

function validateRequest(value: unknown): PlaygroundRequest | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.provider !== "string" ||
    !PROVIDERS.has(candidate.provider) ||
    typeof candidate.model !== "string" ||
    typeof candidate.mode !== "string" ||
    !MODES.has(candidate.mode) ||
    typeof candidate.prompt !== "string" ||
    candidate.prompt.trim().length === 0
  ) {
    return undefined;
  }

  if (candidate.mode === "edit") {
    if (
      typeof candidate.referenceImageUrl !== "string" ||
      !isPublicHttpUrl(candidate.referenceImageUrl)
    ) {
      return undefined;
    }
  }

  if (
    candidate.mode === "video" &&
    candidate.referenceImageUrl !== undefined &&
    (typeof candidate.referenceImageUrl !== "string" ||
      !isPublicHttpUrl(candidate.referenceImageUrl))
  ) {
    return undefined;
  }

  if (
    candidate.n !== undefined &&
    (typeof candidate.n !== "number" ||
      !Number.isInteger(candidate.n) ||
      candidate.n < 1 ||
      candidate.n > 4)
  ) {
    return undefined;
  }
  if (candidate.size !== undefined && typeof candidate.size !== "string") {
    return undefined;
  }
  if (
    candidate.resolution !== undefined &&
    typeof candidate.resolution !== "string"
  ) {
    return undefined;
  }
  if (
    candidate.duration !== undefined &&
    (typeof candidate.duration !== "number" ||
      !Number.isInteger(candidate.duration))
  ) {
    return undefined;
  }

  return {
    provider: candidate.provider as PlaygroundRequest["provider"],
    model: candidate.model,
    mode: candidate.mode as PlaygroundRequest["mode"],
    prompt: candidate.prompt.trim(),
    referenceImageUrl:
      typeof candidate.referenceImageUrl === "string"
        ? candidate.referenceImageUrl
        : undefined,
    size: typeof candidate.size === "string" ? candidate.size : undefined,
    n: typeof candidate.n === "number" ? candidate.n : undefined,
    resolution:
      typeof candidate.resolution === "string"
        ? candidate.resolution
        : undefined,
    duration:
      typeof candidate.duration === "number" ? candidate.duration : undefined,
  };
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
