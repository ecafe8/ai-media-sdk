import type { AzureOpenAIConfig } from "@ai-media/provider-azure-openai";

export function readAzureConfig(
  env: NodeJS.ProcessEnv = process.env
): AzureOpenAIConfig {
  const missing = [
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_VERSION",
    "AZURE_OPENAI_DEPLOYMENT",
  ].filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
  return {
    apiKey: env.AZURE_OPENAI_API_KEY as string,
    endpoint: env.AZURE_OPENAI_ENDPOINT as string,
    apiVersion: env.AZURE_OPENAI_API_VERSION as string,
  };
}

export function readAzureDeployments(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  return (env.AZURE_OPENAI_DEPLOYMENT as string)
    .split(",")
    .map((deployment) => deployment.trim())
    .filter(Boolean);
}
