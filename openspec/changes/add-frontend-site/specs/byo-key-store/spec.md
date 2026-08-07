## Purpose

体验者自带 Provider 凭证（BYO Key）的浏览器端管理：凭证字段定义、本地持久化、配置状态推导，以及"Key 仅存本地、仅发往对应 Provider、不落日志"的安全约束。

## ADDED Requirements

### Requirement: Per-provider credential field sets

系统 SHALL 为每家 Provider 定义其完整凭证字段集：`azure-openai` 需要 `apiKey` + `endpoint` + `apiVersion`；`aliyun-bailian` 需要 `apiKey` + `baseUrl`；`doubao-seedream` 需要 `apiKey`（`baseUrl` 可选）。字段集 SHALL 与服务端 Playground 的凭证解析规则保持一致。

#### Scenario: Complete credential set marks a provider configured

- **WHEN** 体验者填齐某 Provider 的全部必填字段
- **THEN** 该 Provider SHALL 被标记为已配置，其模型在 Playground 中可提交

#### Scenario: Partial credential set does not configure a provider

- **WHEN** 体验者仅填写某 Provider 的部分必填字段（如 Azure 只填 apiKey）
- **THEN** 该 Provider SHALL 保持未配置状态，并在提交时提示缺少哪些字段

### Requirement: Credentials persist in the browser only

凭证 SHALL 持久化到体验者浏览器本地存储并在会话间保留；系统 SHALL 提供设置面板用于查看、修改与清除凭证。凭证 MUST NOT 被发送到任何非对应 Provider 的目的地，MUST NOT 出现在 URL、查询参数或日志中，且 MUST NOT 被任何服务端接收（站点无服务端）。

#### Scenario: Credentials survive a page reload

- **WHEN** 体验者填写凭证并刷新页面
- **THEN** 凭证 SHALL 仍然存在且对应 Provider 仍处于已配置状态

#### Scenario: Clearing credentials removes them

- **WHEN** 体验者在设置面板清除某 Provider 的凭证
- **THEN** 该凭证 SHALL 从本地存储删除，Provider 回到未配置状态，且刷新后不复现

#### Scenario: Corrupted stored credentials are sanitized

- **WHEN** 本地存储中的凭证数据损坏或含未知字段
- **THEN** 读取 SHALL 不抛错，仅保留合法 Provider 的合法字符串字段，其余丢弃

### Requirement: Credentials are sent only to their own provider

当发起对某 Provider 的生成请求时，系统 SHALL 仅使用该 Provider 自己的凭证构造请求；MUST NOT 将 A Provider 的凭证附带在发往 B Provider 的请求中。

#### Scenario: Request to one provider carries only its credentials

- **WHEN** 体验者向 `aliyun-bailian` 发起生成请求
- **THEN** 请求 SHALL 仅携带 Bailian 凭证，不包含 Azure 或 Seedream 凭证
