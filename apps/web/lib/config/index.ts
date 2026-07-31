/**
 * 配置管理模块
 *
 * 从 .env 文件加载环境变量，使用 zod 进行 schema 验证。
 * 启动时调用 loadConfig() 获取类型安全的配置对象。
 *
 * 所有字段均为可选：Playground 是受控开发工具，至少配置一个
 * Provider 即可使用，未配置的 Provider 在 UI 上显示为不可用。
 */
import "dotenv/config";

import { z } from "zod";

const configSchema = z.object({
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
  AZURE_OPENAI_API_VERSION: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
  ALIYUN_BAILIAN_API_KEY: z.string().optional(),
  ALIYUN_BAILIAN_BASE_URL: z.string().url().optional(),
  PLAYGROUND_PROVIDER_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(600_000)
    .default(120_000),
});

export type AppConfig = z.infer<typeof configSchema>;

let cachedConfig: AppConfig | undefined;

/**
 * 加载并验证环境变量，返回类型安全的配置对象。
 *
 * 首次调用执行 zod 解析；后续调用返回缓存。校验失败时抛出
 * 包含字段级错误信息的 Error，但不泄露任何已填入的值。
 */
export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    throw new Error(
      `Invalid environment configuration: ${JSON.stringify(errors)}`
    );
  }
  cachedConfig = result.data;
  return cachedConfig;
}
