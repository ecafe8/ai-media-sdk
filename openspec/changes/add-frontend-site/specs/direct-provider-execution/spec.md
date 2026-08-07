## Purpose

浏览器直连 Provider 的请求执行能力：用本地存储的凭证实例化 Provider，直接在浏览器执行图像/视频生成与异步任务轮询，并将结果与错误映射为体验者可理解的反馈。

## ADDED Requirements

### Requirement: Generation runs directly in the browser against provider APIs

系统 SHALL 在浏览器内使用 `@ai-media/sdk` 与 Provider 工厂直接执行图像生成、图像编辑、图像异步任务与视频异步任务，请求直发对应 Provider 的 API 端点，不经过任何中转服务器。Provider 端点 SHALL 满足浏览器 CORS 要求（DashScope/Ark/Azure 已实测允许）。

#### Scenario: Image generation completes without a relay server

- **WHEN** 体验者提交一个图像生成请求且凭证有效
- **THEN** 浏览器 SHALL 直接向 Provider 端点发起请求并返回生成结果，全程无中转服务端参与

#### Scenario: Async video task is polled in the browser

- **WHEN** 体验者提交一个异步视频任务
- **THEN** 系统 SHALL 在浏览器内轮询任务状态直至成功或失败，并将最终视频结果呈现给体验者

### Requirement: Missing or incomplete credentials produce guidance, not a network call

当所选 Provider 未配置完整凭证时，系统 SHALL 在本地拦截请求并给出"缺少哪些凭证字段"的引导，MUST NOT 发起任何 Provider 网络调用。

#### Scenario: Submit without credentials is blocked locally

- **WHEN** 体验者选择一个未配置凭证的 Provider 并提交
- **THEN** 系统 SHALL 显示凭证缺失提示且不发出任何网络请求

### Requirement: Provider errors map to actionable user messages

系统 SHALL 将 SDK 错误码映射为面向体验者的可操作文案：认证失败（检查 Key）、限流（稍后重试）、超时（重试）、网络不可达（检查网络/端点）、无效请求（检查模型与输入）。未知错误 SHALL 给出通用失败文案而不泄露内部细节。

#### Scenario: Auth failure shows a key-check hint

- **WHEN** Provider 返回认证失败（401/403）
- **THEN** 系统 SHALL 显示"检查 API Key"类的可操作提示，而不是原始堆栈或内部错误对象

#### Scenario: Unknown errors do not leak internals

- **WHEN** 发生未分类错误
- **THEN** 系统 SHALL 显示通用失败文案，不暴露堆栈、内部路径或凭证内容

### Requirement: Video generation stays Aliyun-only

视频模态 SHALL 仅对 `aliyun-bailian` Provider 可用，与现有 Playground 行为一致；对其他 Provider 选择视频模态或视频模型 SHALL 被拒绝并说明原因。

#### Scenario: Non-Aliyun video request is rejected

- **WHEN** 请求的模态为视频且 Provider 非 `aliyun-bailian`
- **THEN** 系统 SHALL 拒绝执行并提示视频生成仅支持 Aliyun Bailian
