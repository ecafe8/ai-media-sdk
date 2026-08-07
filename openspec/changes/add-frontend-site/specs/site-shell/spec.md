## Purpose

纯前端站点的 Landing 页与 Playground 页外壳：承载产品介绍与体验入口的 SPA 路由、由模型注册表驱动的内容展示，以及 BYO（自带 Key）环境下的状态标识与文案。

## ADDED Requirements

### Requirement: Landing page presents the product and playground entry

站点根路由 SHALL 提供 Landing 页，包含产品 hero、核心特性介绍、模型支持矩阵与进入 Playground 的入口。模型矩阵 SHALL 由 SDK 模型注册表（`PLAYGROUND_MODELS`）在运行时派生，按 Provider 分组展示模型与能力（生成/编辑/视频），不得手工硬编码模型清单。Landing 页 SHALL 包含隐私说明：体验者 Key 仅存于其浏览器并直接发送给对应 Provider，不经过任何中间服务器。

#### Scenario: Model matrix reflects the SDK registry

- **WHEN** 访问者打开 Landing 页
- **THEN** 模型矩阵 SHALL 展示注册表中全部三家 Provider 的模型及其能力标记，且与 `PLAYGROUND_MODELS` 数据一致

#### Scenario: Privacy statement is visible before entering the playground

- **WHEN** 访问者浏览 Landing 页
- **THEN** 页面 SHALL 明示 Key 的存储位置（浏览器本地）与传输对象（仅对应 Provider）

### Requirement: SPA routing with landing and playground routes

站点 SHALL 提供 `/`（Landing）与 `/playground` 两个客户端路由，支持浏览器前进/后退与深链访问；部署环境下直接访问 `/playground` SHALL 能正常渲染 Playground 而非平台错误页。

#### Scenario: Deep link to the playground renders

- **WHEN** 访问者在部署环境直接打开 `/playground` 深链
- **THEN** 站点 SHALL 渲染 Playground 页而不是 404 或平台错误页

### Requirement: Playground shell shows BYO environment state

Playground 页 SHALL 展示站点标识、环境状态标识与模态切换（图像/视频，音频置灰为"即将推出"）。当体验者未配置任何 Provider Key 时，环境标识 SHALL 明确提示当前为自带 Key 体验环境并引导打开 Key 设置；页脚 SHALL 说明 Key 的本地存储与直连传输方式。

#### Scenario: No keys configured shows guidance

- **WHEN** 体验者未填写任何 Provider Key 且打开 Playground
- **THEN** 页面 SHALL 显示自带 Key 环境标识与"设置 API Key"引导，且生成按钮处于不可提交状态并说明原因

#### Scenario: Configured providers reflected in the shell

- **WHEN** 体验者已完整填写至少一个 Provider 的 Key
- **THEN** 环境标识 SHALL 反映已配置状态，且对应 Provider 的模型在工作台中可选可提交
