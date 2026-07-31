import {
  editImage,
  generateImage,
  SdkError,
  createTransport,
  type GenerationResult,
  type ImageContent,
  type ImageModelInstance,
} from "@ai-media/sdk";
import {
  createAliyunBailianProvider,
  type AliyunBailianProvider,
} from "@ai-media/provider-aliyun-bailian";
import {
  createAzureOpenAIProvider,
  type AzureOpenAIProvider,
} from "@ai-media/provider-azure-openai";

import { loadConfig } from "@/lib/config";
import { getPlaygroundModel } from "./registry";
import type {
  PlaygroundModel,
  PlaygroundRequest,
  PlaygroundResponse,
} from "./types";

interface ProviderSelection {
  readonly model: PlaygroundModel;
  readonly instance: ImageModelInstance;
}

export function getConfiguredProviders(): ReadonlySet<
  "azure-openai" | "aliyun-bailian"
> {
  const config = loadConfig();
  const configured = new Set<"azure-openai" | "aliyun-bailian">();
  if (
    config.AZURE_OPENAI_API_KEY &&
    config.AZURE_OPENAI_ENDPOINT &&
    config.AZURE_OPENAI_API_VERSION &&
    config.AZURE_OPENAI_DEPLOYMENT
  ) {
    configured.add("azure-openai");
  }
  if (config.ALIYUN_BAILIAN_API_KEY && config.ALIYUN_BAILIAN_BASE_URL) {
    configured.add("aliyun-bailian");
  }
  return configured;
}

export function createProviderSelection(
  request: PlaygroundRequest
): ProviderSelection {
  const config = loadConfig();
  const configured = getConfiguredProviders();
  if (!configured.has(request.provider)) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "The selected Provider is not configured on the server",
    });
  }

  const model = getPlaygroundModel(request.provider, request.model);
  if (!model) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "The selected model is not available for this Provider",
    });
  }

  if (request.mode === "edit" && !model.supportsEdit) {
    throw new SdkError({
      code: "INVALID_REQUEST",
      message: "The selected model does not support image editing",
    });
  }

  if (request.provider === "azure-openai") {
    const provider: AzureOpenAIProvider = createAzureOpenAIProvider(
      {
        apiKey: config.AZURE_OPENAI_API_KEY!,
        endpoint: config.AZURE_OPENAI_ENDPOINT!,
        apiVersion: config.AZURE_OPENAI_API_VERSION!,
      },
      {
        transport: createTransport({
          defaultTimeoutMs: config.PLAYGROUND_PROVIDER_TIMEOUT_MS,
        }),
      }
    );
    return { model, instance: provider.image(request.model) };
  }

  const provider: AliyunBailianProvider = createAliyunBailianProvider(
    {
      apiKey: config.ALIYUN_BAILIAN_API_KEY!,
      baseUrl: config.ALIYUN_BAILIAN_BASE_URL!,
    },
    {
      transport: createTransport({
        defaultTimeoutMs: config.PLAYGROUND_PROVIDER_TIMEOUT_MS,
      }),
    }
  );
  return { model, instance: provider.image(request.model) };
}

export async function executePlaygroundRequest(
  request: PlaygroundRequest
): Promise<PlaygroundResponse> {
  const startedAt = Date.now();

  try {
    const config = loadConfig();
    logPlaygroundEvent("start", request, {
      timeoutMs: config.PLAYGROUND_PROVIDER_TIMEOUT_MS,
    });
    const selection = createProviderSelection(request);
    let result: GenerationResult<ImageContent[]>;

    if (request.mode === "edit") {
      result = await editImage({
        model: selection.instance,
        prompt: request.prompt,
        images: [{ url: request.referenceImageUrl }],
      });
    } else {
      result = await generateImage({
        model: selection.instance,
        prompt: request.prompt,
        n: request.n,
        size: request.size,
      });
    }

    const response: PlaygroundResponse = {
      status: "succeeded",
      images: result.content,
      metadata: {
        provider: result.provider,
        model: result.model,
        requestId: result.requestId,
        ...readUsage(result.raw),
      },
    };
    logPlaygroundEvent("success", request, {
      durationMs: Date.now() - startedAt,
      requestId: result.requestId,
    });
    return response;
  } catch (error) {
    const safeError = toSafeError(error);
    logPlaygroundEvent("failure", request, {
      code: safeError.code,
      durationMs: Date.now() - startedAt,
      retryable: error instanceof SdkError ? error.retryable : false,
    });
    return { status: "failed", error: safeError };
  }
}

function logPlaygroundEvent(
  event: "start" | "success" | "failure",
  request: PlaygroundRequest,
  details: Readonly<Record<string, unknown>>
): void {
  const payload = {
    event: `playground.provider_request.${event}`,
    provider: request.provider,
    model: request.model,
    mode: request.mode,
    ...details,
  };

  if (event === "failure") {
    console.error(JSON.stringify(payload));
    return;
  }
  console.info(JSON.stringify(payload));
}

function readUsage(raw: unknown): {
  readonly width?: number;
  readonly height?: number;
  readonly imageCount?: number;
} {
  if (typeof raw !== "object" || raw === null) return {};
  const usage = (raw as { usage?: unknown }).usage;
  if (typeof usage !== "object" || usage === null) return {};
  const candidate = usage as Record<string, unknown>;
  return {
    width: typeof candidate.width === "number" ? candidate.width : undefined,
    height: typeof candidate.height === "number" ? candidate.height : undefined,
    imageCount:
      typeof candidate.image_count === "number"
        ? candidate.image_count
        : undefined,
  };
}

function toSafeError(error: unknown): NonNullable<PlaygroundResponse["error"]> {
  if (error instanceof SdkError) {
    return {
      code: error.code,
      message: safeMessage(error.code),
    };
  }
  return {
    code: "UNKNOWN",
    message: "The image request failed. Please try again.",
  };
}

function safeMessage(code: SdkError["code"]): string {
  switch (code) {
    case "AUTH_ERROR":
      return "Provider authentication failed. Check the server environment.";
    case "INVALID_REQUEST":
      return "The request is not supported. Check the selected model and inputs.";
    case "RATE_LIMITED":
      return "The Provider is rate limiting requests. Try again later.";
    case "TIMEOUT":
      return "The Provider request timed out. Try again.";
    case "NETWORK_ERROR":
      return "The Provider could not be reached. Check the server network.";
    case "NOT_IMPLEMENTED":
      return "This Provider capability is not available in the current SDK slice.";
    default:
      return "The image request failed. Please try again.";
  }
}
