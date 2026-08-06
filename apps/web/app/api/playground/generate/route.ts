import { NextResponse } from "next/server";

import { executePlaygroundRequest } from "@/lib/playground/server";
import type { PlaygroundRequest } from "@/lib/playground/types";

const PROVIDERS = new Set([
  "azure-openai",
  "aliyun-bailian",
  "doubao-seedream",
]);
const MODALITIES = new Set(["image", "video"]);
const IMAGE_OPERATIONS = new Set(["generate", "edit"]);

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
            message:
              "Provide a Provider, model, modality, and non-empty prompt.",
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
    typeof candidate.modality !== "string" ||
    !MODALITIES.has(candidate.modality) ||
    typeof candidate.prompt !== "string" ||
    candidate.prompt.trim().length === 0
  ) {
    return undefined;
  }

  if (
    candidate.imageOperation !== undefined &&
    (typeof candidate.imageOperation !== "string" ||
      !IMAGE_OPERATIONS.has(candidate.imageOperation))
  ) {
    return undefined;
  }

  if (candidate.imageOperation === "edit") {
    if (
      typeof candidate.referenceImageUrl !== "string" ||
      !isPublicHttpUrl(candidate.referenceImageUrl)
    ) {
      return undefined;
    }
  }

  if (
    candidate.modality === "video" &&
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
      candidate.n > 6)
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
  if (
    candidate.audioSetting !== undefined &&
    typeof candidate.audioSetting !== "string"
  ) {
    return undefined;
  }
  if (
    candidate.inputVideoUrl !== undefined &&
    (typeof candidate.inputVideoUrl !== "string" ||
      !isPublicHttpUrl(candidate.inputVideoUrl))
  ) {
    return undefined;
  }
  let referenceImageUrls: string[] | undefined;
  if (candidate.referenceImageUrls !== undefined) {
    if (
      !Array.isArray(candidate.referenceImageUrls) ||
      !candidate.referenceImageUrls.every(
        (item) => typeof item === "string" && isPublicHttpUrl(item)
      )
    ) {
      return undefined;
    }
    referenceImageUrls = candidate.referenceImageUrls as string[];
  }

  return {
    provider: candidate.provider as PlaygroundRequest["provider"],
    model: candidate.model,
    modality: candidate.modality as PlaygroundRequest["modality"],
    imageOperation:
      typeof candidate.imageOperation === "string"
        ? (candidate.imageOperation as PlaygroundRequest["imageOperation"])
        : undefined,
    prompt: candidate.prompt.trim(),
    referenceImageUrl:
      typeof candidate.referenceImageUrl === "string"
        ? candidate.referenceImageUrl
        : undefined,
    referenceImageUrls,
    inputVideoUrl:
      typeof candidate.inputVideoUrl === "string"
        ? candidate.inputVideoUrl
        : undefined,
    size: typeof candidate.size === "string" ? candidate.size : undefined,
    n: typeof candidate.n === "number" ? candidate.n : undefined,
    resolution:
      typeof candidate.resolution === "string"
        ? candidate.resolution
        : undefined,
    duration:
      typeof candidate.duration === "number" ? candidate.duration : undefined,
    audioSetting:
      typeof candidate.audioSetting === "string"
        ? candidate.audioSetting
        : undefined,
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
