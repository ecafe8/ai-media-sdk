## Purpose

Playground 图片输入控件：URL 粘贴与本地文件上传的混合输入，覆盖图生图参考图、i2v 首帧（单值）与 r2v 参考图（有序卡片列表），含大小校验、来源标记与缓存复用交互。

## ADDED Requirements

### Requirement: Single image fields accept URL paste or local upload

图生图参考图与 i2v 首帧输入 SHALL 同时支持粘贴公网 URL 与选择本地文件两种方式。选择本地文件后 SHALL 显示缩略预览、文件大小与来源标记（上传/缓存），并允许移除后回到 URL 输入。

#### Scenario: Pasting a URL uses the URL path

- **WHEN** 体验者在单值输入粘贴合法 http(s) URL
- **THEN** 提交时 SHALL 以 `{ url }` 形式传入 SDK

#### Scenario: Selecting a local file uses the base64 path

- **WHEN** 体验者在单值输入选择一个本地图片文件
- **THEN** 提交时 SHALL 以 `{ base64, mimeType }` 形式传入 SDK，且界面显示缩略预览与来源标记

### Requirement: r2v reference images use an ordered card list

r2v 参考图输入 SHALL 为有序卡片列表，顺序即 prompt 中 `[Image N]` 的指代顺序。列表 SHALL 支持多文件上传、单条 URL 添加与批量 URL 粘贴三种添加方式，每张卡片展示缩略图、来源与删除操作；条目数 SHALL 受所选模型的 `maxReferenceImages` 上限约束。

#### Scenario: Card order maps to Image N references

- **WHEN** 体验者依次添加三张参考图并提交
- **THEN** 请求中的参考图顺序 SHALL 与卡片顺序一致，分别对应 `[Image 1]` 至 `[Image 3]`

#### Scenario: Batch URL paste adds multiple cards

- **WHEN** 体验者通过批量粘贴入口提交多个 URL
- **THEN** 系统 SHALL 按顺序为每个合法 URL 创建一张卡片，非法 URL 被拒绝并提示

#### Scenario: Exceeding the model reference cap is blocked

- **WHEN** 卡片数已达所选模型上限且体验者尝试继续添加
- **THEN** 系统 SHALL 阻止添加并提示上限值

### Requirement: Uploaded images respect a size limit

本地上传 SHALL 施加单文件大小上限（默认 5MB，可配置）。超限文件 SHALL 在选择时被拒绝并提示大小限制；校验 SHALL 在发送到 Provider 之前完成。

#### Scenario: Oversized file is rejected before upload

- **WHEN** 体验者选择超过大小上限的文件
- **THEN** 系统 SHALL 拒绝该文件并显示大小限制提示，不发起任何请求

### Requirement: Cache integration marks reused files

图片输入与媒体缓存 SHALL 联动：选择的文件命中缓存时直接复用并显示"来自缓存"；未命中时写入缓存后供后续复用。

#### Scenario: Cached file reuse shows a badge

- **WHEN** 体验者选择一个已缓存的文件
- **THEN** 输入控件 SHALL 显示"来自缓存"标记并跳过重复存储

### Requirement: Video-edit source video remains URL-only

video-edit 源视频输入 SHALL 仅支持公网 URL 粘贴，MUST NOT 提供本地文件上传控件，并 SHALL 显示"仅支持公网 URL"的说明。上传管线 SHALL 预留视频 MIME 的扩展空间但本期不启用。

#### Scenario: No upload control for input video

- **WHEN** 体验者使用 video-edit 模型
- **THEN** 源视频输入 SHALL 仅为 URL 输入框并附公网 URL 说明，无上传按钮
