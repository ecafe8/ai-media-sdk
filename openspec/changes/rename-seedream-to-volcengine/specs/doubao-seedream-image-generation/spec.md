## REMOVED Requirements

### Requirement: Seedream adapter dispatches by an in-package model registry
**Reason**: 能力整体更名为厂商级 `volcengine-image-generation`,行为不变,标识符更新。
**Migration**: 使用 `volcengine-image-generation` 能力;`providerId` 改为 `volcengine`。

### Requirement: Seedream request is built via the shared transport
**Reason**: 能力整体更名为厂商级 `volcengine-image-generation`,行为不变,标识符更新。
**Migration**: 原生参数改经 `providerOptions.volcengine` 命名空间透传。

### Requirement: Seedream sync response maps to image content results
**Reason**: 能力整体更名为厂商级 `volcengine-image-generation`,行为不变,标识符更新。
**Migration**: 生成结果 `provider` 字段改为 `volcengine`。

### Requirement: Seedream image editing reuses the T2I endpoint with an image field
**Reason**: 能力整体更名为厂商级 `volcengine-image-generation`,行为不变,标识符更新。
**Migration**: 使用 `volcengine-image-generation` 的对应需求。

### Requirement: Image inputs map to Seedream image entries
**Reason**: 能力整体更名为厂商级 `volcengine-image-generation`,行为不变,标识符更新。
**Migration**: 使用 `volcengine-image-generation` 的对应需求。

### Requirement: Seedream HTTP failures classify to stable SDK error codes
**Reason**: 能力整体更名为厂商级 `volcengine-image-generation`,行为不变,标识符更新。
**Migration**: 使用 `volcengine-image-generation` 的对应需求。

### Requirement: Seedream config requires an API key and a regional base URL
**Reason**: 能力整体更名为厂商级 `volcengine-image-generation`,行为不变,标识符更新。
**Migration**: 配置类型由 `SeedreamConfig` 更名为 `VolcengineConfig`。

### Requirement: editImage pre-flight validates edit capability and image count
**Reason**: 能力整体更名为厂商级 `volcengine-image-generation`,行为不变,标识符更新。
**Migration**: 使用 `volcengine-image-generation` 的对应需求。
