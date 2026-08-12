import type { AppConfig } from "@/lib/config";
import type {
  PlaygroundCredentials,
  PlaygroundProvider,
} from "@/lib/playground/types";

/**
 * Raised when a request cannot obtain usable Provider credentials: neither
 * visitor-supplied credentials nor server-side environment configuration are
 * complete for the selected Provider. Mapped to the `CONFIGURATION_ERROR`
 * response code by the Playground executor.
 */
export class PlaygroundConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaygroundConfigurationError";
  }
}

export interface ResolvedAzureCredentials {
  readonly apiKey: string;
  readonly endpoint: string;
  readonly apiVersion: string;
}

export interface ResolvedAliyunCredentials {
  readonly apiKey: string;
  readonly baseUrl: string;
}

export interface ResolvedSeedreamCredentials {
  readonly apiKey: string;
  readonly baseUrl?: string;
}

export interface ResolvedMiniMaxCredentials {
  readonly apiKey: string;
  readonly baseUrl?: string;
}

/**
 * Resolve the effective Azure OpenAI credentials.
 *
 * Visitor-supplied credentials take precedence: once a non-empty `apiKey` is
 * supplied the request is treated as BYO Key and must be complete (partial
 * input errors instead of silently falling back to the server environment).
 * Otherwise the server environment is used; when neither source is complete
 * a `PlaygroundConfigurationError` explains what the visitor should provide.
 */
export function resolveAzureCredentials(
  user: PlaygroundCredentials | undefined,
  config: AppConfig
): ResolvedAzureCredentials {
  if (user?.apiKey.trim()) {
    const missing: string[] = [];
    if (!user.endpoint?.trim()) missing.push("Endpoint");
    if (!user.apiVersion?.trim()) missing.push("API Version");
    if (missing.length > 0) {
      throw new PlaygroundConfigurationError(
        `使用自带 Key 时，Azure OpenAI 还需要填写：${missing.join("、")}。`
      );
    }
    return {
      apiKey: user.apiKey.trim(),
      endpoint: user.endpoint!.trim(),
      apiVersion: user.apiVersion!.trim(),
    };
  }
  if (
    config.AZURE_OPENAI_API_KEY &&
    config.AZURE_OPENAI_ENDPOINT &&
    config.AZURE_OPENAI_API_VERSION
  ) {
    return {
      apiKey: config.AZURE_OPENAI_API_KEY,
      endpoint: config.AZURE_OPENAI_ENDPOINT,
      apiVersion: config.AZURE_OPENAI_API_VERSION,
    };
  }
  throw new PlaygroundConfigurationError(
    "服务端未配置 Azure OpenAI。请填写你的 API Key、Endpoint 和 API Version 后再体验。"
  );
}

/**
 * Resolve the effective Alibaba Bailian (DashScope) credentials. Same
 * precedence rules as `resolveAzureCredentials`.
 */
export function resolveAliyunCredentials(
  user: PlaygroundCredentials | undefined,
  config: AppConfig
): ResolvedAliyunCredentials {
  if (user?.apiKey.trim()) {
    if (!user.baseUrl?.trim()) {
      throw new PlaygroundConfigurationError(
        "使用自带 Key 时，Alibaba Bailian 还需要填写 Base URL。"
      );
    }
    return { apiKey: user.apiKey.trim(), baseUrl: user.baseUrl.trim() };
  }
  if (config.ALIYUN_BAILIAN_API_KEY && config.ALIYUN_BAILIAN_BASE_URL) {
    return {
      apiKey: config.ALIYUN_BAILIAN_API_KEY,
      baseUrl: config.ALIYUN_BAILIAN_BASE_URL,
    };
  }
  throw new PlaygroundConfigurationError(
    "服务端未配置 Alibaba Bailian。请填写你的 DashScope API Key 和 Base URL 后再体验。"
  );
}

/**
 * Resolve the effective Volcengine Ark (Seedream) credentials. Same
 * precedence rules as `resolveAzureCredentials`; `baseUrl` stays optional.
 */
export function resolveSeedreamCredentials(
  user: PlaygroundCredentials | undefined,
  config: AppConfig
): ResolvedSeedreamCredentials {
  if (user?.apiKey.trim()) {
    return {
      apiKey: user.apiKey.trim(),
      ...(user.baseUrl?.trim() ? { baseUrl: user.baseUrl.trim() } : {}),
    };
  }
  if (config.ARK_API_KEY) {
    return {
      apiKey: config.ARK_API_KEY,
      ...(config.ARK_BASE_URL ? { baseUrl: config.ARK_BASE_URL } : {}),
    };
  }
  throw new PlaygroundConfigurationError(
    "服务端未配置 Doubao Seedream。请填写你的 Ark API Key 后再体验。"
  );
}

/**
 * Resolve the effective MiniMax credentials. Same precedence rules as
 * `resolveSeedreamCredentials`; `baseUrl` stays optional and falls back to
 * the provider's `https://api.minimax.io` default.
 */
export function resolveMiniMaxCredentials(
  user: PlaygroundCredentials | undefined,
  config: AppConfig
): ResolvedMiniMaxCredentials {
  if (user?.apiKey.trim()) {
    return {
      apiKey: user.apiKey.trim(),
      ...(user.baseUrl?.trim() ? { baseUrl: user.baseUrl.trim() } : {}),
    };
  }
  if (config.MINIMAX_API_KEY) {
    return {
      apiKey: config.MINIMAX_API_KEY,
      ...(config.MINIMAX_BASE_URL ? { baseUrl: config.MINIMAX_BASE_URL } : {}),
    };
  }
  throw new PlaygroundConfigurationError(
    "服务端未配置 MiniMax。请填写你的 MiniMax API Key 后再体验。"
  );
}

/**
 * Whether a Provider has complete server-side environment configuration.
 * Mirrors the configured-provider projection used by the Playground UI.
 */
export function isProviderConfiguredByEnv(
  provider: PlaygroundProvider,
  config: AppConfig
): boolean {
  switch (provider) {
    case "azure-openai":
      return Boolean(
        config.AZURE_OPENAI_API_KEY &&
          config.AZURE_OPENAI_ENDPOINT &&
          config.AZURE_OPENAI_API_VERSION
      );
    case "aliyun-bailian":
      return Boolean(
        config.ALIYUN_BAILIAN_API_KEY && config.ALIYUN_BAILIAN_BASE_URL
      );
    case "doubao-seedream":
      return Boolean(config.ARK_API_KEY);
    case "minimax":
      return Boolean(config.MINIMAX_API_KEY);
  }
}
