export type { MiniMaxConfig } from "./config/index.ts";
export type {
  MiniMaxProvider,
  MiniMaxProviderOptions,
} from "./provider/index.ts";
export { createMiniMaxProvider } from "./provider/index.ts";
export type {
  MiniMaxH3VideoParams,
  MiniMaxVideoOptions,
  MiniMaxVideoRatio,
} from "./provider/params.ts";
export type {
  MiniMaxModelEntry,
  MiniMaxModelFamily,
} from "./provider/registry.ts";
export {
  MINIMAX_MODEL_REGISTRY,
  minimaxModelRegistry,
} from "./provider/registry.ts";
