export type { AzureOpenAIConfig } from "./config/index.ts";
export type {
  AzureOpenAIProvider,
  AzureOpenAIProviderOptions,
} from "./provider/index.ts";
export {
  createAzureModel,
  createAzureOpenAIProvider,
} from "./provider/index.ts";
export type { AzureImageProviderOptions } from "./provider/options.ts";
export type { AzureGptImage2Params } from "./provider/params.ts";
export type { AzureModelEntry } from "./provider/registry.ts";
export {
  AZURE_MODEL_REGISTRY,
  azureModelRegistry,
} from "./provider/registry.ts";
