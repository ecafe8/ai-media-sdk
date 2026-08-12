## RENAMED Requirements

### Requirement: Video generation stays Aliyun-only

FROM: Video generation stays Aliyun-only
TO: Video generation is available for Aliyun and MiniMax

## MODIFIED Requirements

### Requirement: Video generation is available for Aliyun and MiniMax

视频模态 SHALL 对 `aliyun-bailian` 与 `minimax` 两家 Provider 可用；对其他 Provider 选择视频模态或视频模型 SHALL 被拒绝并说明原因。视频请求的 Provider 原生参数 SHALL 按 Provider 命名空间构建：Aliyun 使用 `providerOptions.aliyun`（含 `watermark`/`audio_setting` 语义），MiniMax 使用 `providerOptions.minimax`（必填 `resolution`/`duration`，按场景携带 `ratio`，不含 `watermark`/`audio_setting`）。MiniMax 视频输入 SHALL 支持 `firstFrame`/`lastFrame`、有序 `referenceImages`、有序 `referenceVideos` 与 `referenceAudios`，并透传给 `submitVideoTask`。

#### Scenario: Non-supported video provider is rejected

- **WHEN** 请求的模态为视频且 Provider 非 `aliyun-bailian` 或 `minimax`
- **THEN** 系统 SHALL 拒绝执行并提示视频生成仅支持 Aliyun Bailian 与 MiniMax

#### Scenario: MiniMax video task executes in the browser

- **WHEN** 体验者使用已配置的 MiniMax 凭证提交视频任务
- **THEN** 系统 SHALL 通过 `createMiniMaxProvider` 直连 MiniMax API 提交任务并在浏览器内轮询结果

#### Scenario: MiniMax requests use the minimax options namespace

- **WHEN** 系统为 MiniMax 视频任务构建 providerOptions
- **THEN** SHALL 仅包含 `minimax` 命名空间的 `resolution`/`duration`/`ratio`（按场景），不得携带 Aliyun 专属字段
