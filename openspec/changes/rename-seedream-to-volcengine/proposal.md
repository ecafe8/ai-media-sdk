## Why

`provider-seedream` 以单一图像模型家族(Seedream)命名,但字节的视频生成家族名为 Seedance,该包名无法同时容纳图像与视频;仓库其余 Provider 包均按厂商/平台命名(`azure-openai`、`aliyun-bailian`、`minimax`),seedream 是唯一例外。Seedream 与 Seedance 均托管于火山方舟(Ark),环境变量已是 `ARK_*`,域名为 `*.volces.com`,故收拢为厂商级命名 `provider-volcengine`,对齐既有规律并为 Seedance 视频与未来 Ark 模型预留空间。

## What Changes

- **BREAKING** 工作区包 `packages/provider-seedream` 改名为 `packages/provider-volcengine`,npm 名 `@ai-media/provider-seedream` → `@ai-media/provider-volcengine`。
- **BREAKING** `providerId` 由 `doubao-seedream` 改为 `volcengine`(含模型注册表与生成结果中的 `provider` 字段)。
- **BREAKING** 原生参数命名空间 `providerOptions.seedream` 改为 `providerOptions.volcengine`,对齐 azure/aliyun/minimax 的厂商级命名空间。
- **BREAKING** 导出符号改名:`createSeedreamProvider` → `createVolcengineProvider`、`SeedreamProvider` → `VolcengineProvider`、`SeedreamConfig` → `VolcengineConfig`、`SEEDREAM_MODEL_REGISTRY`/`seedreamModelRegistry` → `VOLCENGINE_MODEL_REGISTRY`/`volcengineModelRegistry`;家族参数类型按 aliyun 先例加厂商前缀(如 `VolcengineSeedream5ProParams`)。
- 模型 ID(`doubao-seedream-*`)与模型家族 slug(`doubao-seedream-5-pro` 等)不变,它们是 API 事实。
- 环境变量前缀保留 `ARK_*` 不变;示例的模型选择变量 `SEEDREAM_MODEL` → `VOLCENGINE_IMAGE_MODEL`(对齐 `ALIYUN_BAILIAN_IMAGE_MODEL`)。
- 示例目录 `examples/seedream-image` 改名为 `examples/volcengine-image`。
- 更新 apps/web 与 apps/site 的全部引用(依赖、别名、provider id、locales 标签键前缀)、根 README 与进行中的 `add-site-docs` 变更工件。
- npm:发布新包名后对已发布的 `@ai-media/provider-seedream` 执行 deprecate 指向新包。

## Capabilities

### New Capabilities

- `volcengine-image-generation`: 火山方舟 Doubao-Seedream 图像生成/编辑适配器能力,由 `doubao-seedream-image-generation` 更名而来,标识符更新为厂商级(providerId `volcengine`、`providerOptions.volcengine`)。

### Modified Capabilities

- `doubao-seedream-image-generation`: 全部需求移除,由新能力 `volcengine-image-generation` 取代。
- `model-family-typing`: 工厂字面量重载需求中的 Seedream 工厂引用更新为 Volcengine(`volcengine.image(...)`)。
- `byo-key-store`: 凭证字段集中 `doubao-seedream` 更新为 `volcengine`。
- `playground-api`: 模型清单派生需求中 `SEEDREAM_MODEL_REGISTRY` 更新为 `VOLCENGINE_MODEL_REGISTRY`。
- `playground-form`: Advanced Options 需求中 `providerOptions.seedream` 更新为 `providerOptions.volcengine`。
- `model-registry-aggregation`: 聚合与注册表投影需求中 `seedreamModelRegistry` 更新为 `volcengineModelRegistry`。
- `provider-package-foundation`: 传输路由与依赖最小化需求中的 Doubao-Seedream/Seedream 包引用更新为 Volcengine Ark。

## Impact

- `packages/provider-seedream`(目录、package.json、全部源码与测试)→ `packages/provider-volcengine`
- `examples/seedream-image` → `examples/volcengine-image`
- `apps/web`:package.json、next.config.ts、lib/config 之外的 playground 全部模块与测试、components/playground/lib
- `apps/site`:package.json、tsconfig、vite.config、src/lib(key-store、provider-client、executor、playground registry)、settings-dialog、locales
- 根 README.md;`docs/prd/` 与已归档变更为历史记录,不改动
- `openspec/changes/add-site-docs` 工件中的 `providers/seedream.mdx` 引用同步为 `providers/volcengine.mdx`
- npm registry:新包发布与旧包 deprecate(合并后执行)
