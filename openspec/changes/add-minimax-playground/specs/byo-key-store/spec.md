## MODIFIED Requirements

### Requirement: Per-provider credential field sets

系统 SHALL 为每家 Provider 定义其完整凭证字段集：`azure-openai` 需要 `apiKey` + `endpoint` + `apiVersion`；`aliyun-bailian` 需要 `apiKey` + `baseUrl`；`doubao-seedream` 需要 `apiKey`（`baseUrl` 可选）；`minimax` 需要 `apiKey`（`baseUrl` 可选，缺省 `https://api.minimax.io`）。字段集 SHALL 与服务端 Playground 的凭证解析规则保持一致。

#### Scenario: Complete credential set marks a provider configured

- **WHEN** 体验者填齐某 Provider 的全部必填字段
- **THEN** 该 Provider SHALL 被标记为已配置，其模型在 Playground 中可提交

#### Scenario: Partial credential set does not configure a provider

- **WHEN** 体验者仅填写某 Provider 的部分必填字段（如 Azure 只填 apiKey）
- **THEN** 该 Provider SHALL 保持未配置状态，并在提交时提示缺少哪些字段

#### Scenario: MiniMax is configured by API key alone

- **WHEN** 体验者仅填写 MiniMax 的 API Key
- **THEN** MiniMax SHALL 被标记为已配置；自定义 Base URL 仅在填写时参与端点校验与确认流程
