export type { AzureOpenAIConfig } from "./config/index.ts";
export type {
  AzureOpenAIProviderOptions,
  AzureOpenAIProvider,
} from "./provider/index.ts";
export type { AzureImageProviderOptions } from "./provider/options.ts";
export type { AzureGptImage2Params } from "./provider/params.ts";
export type { AzureModelEntry } from "./provider/registry.ts";
export {
  AZURE_MODEL_REGISTRY,
  azureModelRegistry,
} from "./provider/registry.ts";
export { createAzureOpenAIProvider, createAzureModel } from "./provider/index.ts";
