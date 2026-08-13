## MODIFIED Requirements

### Requirement: Landing page presents the product and playground entry

站点根路由 SHALL 提供 Landing 页，包含产品 hero、核心特性介绍、模型支持矩阵与进入 Playground 的入口。模型矩阵 SHALL 由 SDK 模型注册表（`PLAYGROUND_MODELS`）在运行时派生，按 Provider 分组展示模型与能力（生成/编辑/视频），不得手工硬编码模型清单。Landing 页的 Provider 文案 SHALL 覆盖全部已接入的 Provider（Azure OpenAI、Alibaba Bailian、Volcengine Ark Seedream 与 MiniMax）。Landing 页 SHALL 包含隐私说明：体验者 Key 仅存于其浏览器并直接发送给对应 Provider，不经过任何中间服务器。

#### Scenario: Model matrix reflects the SDK registry

- **WHEN** 访问者打开 Landing 页
- **THEN** 模型矩阵 SHALL 展示注册表中全部 Provider（含 MiniMax）的模型及其能力标记，且与 `PLAYGROUND_MODELS` 数据一致

#### Scenario: Privacy statement is visible before entering the playground

- **WHEN** 访问者浏览 Landing 页
- **THEN** 页面 SHALL 明示 Key 的存储位置（浏览器本地）与传输对象（仅对应 Provider）
