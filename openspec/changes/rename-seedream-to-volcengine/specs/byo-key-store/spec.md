## MODIFIED Requirements

### Requirement: Per-provider credential field sets

系统 SHALL 为每家 Provider 定义其完整凭证字段集：`azure-openai` 需要 `apiKey` + `endpoint` + `apiVersion`；`aliyun-bailian` 需要 `apiKey` + `baseUrl`；`volcengine` 需要 `apiKey`（`baseUrl` 可选）；`minimax` 需要 `apiKey`（`baseUrl` 可选，缺省 `https://api.minimax.io`）。字段集 SHALL 与服务端 Playground 的凭证解析规则保持一致。

#### Scenario: Complete credential set marks a provider configured

- **WHEN** 体验者填齐某 Provider 的全部必填字段
- **THEN** 该 Provider SHALL 被标记为已配置，其模型在 Playground 中可提交

#### Scenario: Partial credential set does not configure a provider

- **WHEN** 体验者仅填写某 Provider 的部分必填字段（如 Azure 只填 apiKey）
- **THEN** 该 Provider SHALL 保持未配置状态，并在提交时提示缺少哪些字段

#### Scenario: MiniMax is configured by API key alone

- **WHEN** 体验者仅填写 MiniMax 的 API Key
- **THEN** MiniMax SHALL 被标记为已配置；自定义 Base URL 仅在填写时参与端点校验与确认流程

### Requirement: Credentials are sent only to their own provider

当发起对某 Provider 的生成请求时，系统 SHALL 仅使用该 Provider 自己的凭证构造请求；MUST NOT 将 A Provider 的凭证附带在发往 B Provider 的请求中。默认端点 SHALL 使用受支持的 Provider host；用户填写自定义 endpoint/baseUrl 时，系统 SHALL 校验协议、host、端口和路径，并在非默认 host 上发送前要求显式风险确认。

#### Scenario: Request to one provider carries only its credentials

- **WHEN** 体验者向 `aliyun-bailian` 发起生成请求
- **THEN** 请求 SHALL 仅携带 Bailian 凭证，不包含 Azure 或 Volcengine 凭证

#### Scenario: Untrusted custom endpoint requires confirmation

- **WHEN** 体验者填写不属于默认 Provider host 的自定义 endpoint/baseUrl
- **THEN** 系统 SHALL 展示完整目标地址与 Key 外发风险，并在确认前阻止请求

#### Scenario: Invalid endpoint never receives a key

- **WHEN** endpoint/baseUrl 使用非 HTTPS 协议、非法 host、嵌入式用户名密码或不允许的端口
- **THEN** 系统 SHALL 拒绝保存或提交，且 SHALL NOT 发起带凭证的网络请求
