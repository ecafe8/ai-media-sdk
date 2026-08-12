# result-file-save Specification

## Purpose
为生成结果提供用户可控的本地保存目标：在生成前提示临时 URL 风险，允许 Chrome/Edge 用户选择真实目录，生成完成后自动保存图片与视频，同时处理权限、浏览器兼容与 Provider 下载失败。
## Requirements
### Requirement: Result panel exposes save settings before generation

生成结果面板顶部 SHALL 展示保存设置，而不是占用左侧生成参数区域。未选择目录时 SHALL 提示 Provider 结果 URL 可能过期，并提供“选择本地保存目录”和“暂不选择，继续生成”两个操作。选择目录操作 MUST 由用户点击直接触发目录授权。

#### Scenario: First generation shows temporary URL warning

- **WHEN** 体验者尚未选择本地保存目录并准备生成
- **THEN** 右侧生成结果面板顶部 SHALL 显示临时 URL 风险提示与目录选择入口，左侧 SHALL 保持只放生成参数

#### Scenario: User can continue without selecting a directory

- **WHEN** 体验者点击“暂不选择，继续生成”
- **THEN** 生成 SHALL 正常开始，结果以 Provider 临时 URL 预览，并提示结果可能过期

### Requirement: Chrome and Edge users can choose an automatic-save directory

系统 SHALL 能力检测 `showDirectoryPicker`，仅在支持的 Chrome/Edge 浏览器中提供目录选择。目录句柄 SHALL 存储在 IndexedDB，不得存入 localStorage。目录选择成功后，结果面板 SHALL 显示已启用自动保存、目录名称与“更换目录”“取消授权”操作。

#### Scenario: Directory selection enables automatic saving

- **WHEN** Chrome/Edge 用户点击“选择本地保存目录”并完成授权
- **THEN** 系统 SHALL 持久化目录句柄，并在结果面板显示“自动保存已启用”与目录名称

#### Scenario: Unsupported browser shows a warning

- **WHEN** 浏览器不支持 `showDirectoryPicker`
- **THEN** 系统 SHALL 显示“建议使用最新版 Chrome 或 Edge”的告警，不显示目录选择流程，但允许继续生成

### Requirement: Generated results are automatically saved after successful generation

当用户已选择并授权保存目录时，生成成功后的每个图片/视频结果 SHALL 自动下载并写入该目录，无需用户再次点击保存。文件名 SHALL 包含结果类型与时间信息；重名 SHALL 自动追加序号。保存状态 SHALL 在结果卡片显示。

#### Scenario: Image and video results are saved automatically

- **WHEN** 已启用自动保存且一次生成返回多个图片或视频结果
- **THEN** 系统 SHALL 为每个结果写入独立文件，并在对应结果卡片显示“已自动保存”与文件名

#### Scenario: Filename conflicts are resolved

- **WHEN** 目标目录已存在同名结果文件
- **THEN** 系统 SHALL 创建带序号的文件名，不覆盖已有文件

### Requirement: Directory permissions and save failures are recoverable

每次写入前 SHALL 检查目录句柄权限。权限失效、目录被删除、用户拒绝重新授权或 Provider 结果 URL 无法被浏览器 `fetch` 读取时，系统 SHALL 保留临时结果预览、显示明确失败原因并提供重新选择目录入口；MUST NOT 静默丢失生成结果或阻止结果展示。

#### Scenario: Permission expires before a later generation

- **WHEN** 已保存的目录句柄在后续生成前失去写入权限
- **THEN** 系统 SHALL 暂停自动保存并提示重新授权或更换目录，当前生成仍可继续

#### Scenario: Provider result cannot be fetched

- **WHEN** 结果 URL 可在媒体标签中预览但浏览器 `fetch` 因 CORS 或网络失败
- **THEN** 系统 SHALL 保留临时预览并显示自动保存失败状态，不显示“已保存”

### Requirement: User-selected result storage is separate from the OPFS input cache

生成结果自动保存 SHALL 写入用户选择的真实目录，不得写入 OPFS；OPFS 仅用于本地图片输入缓存。参考视频与 video-edit 源视频 SHALL 继续要求公网 URL，不因结果保存目录而获得本地上传能力。

#### Scenario: Result saving does not silently consume OPFS space

- **WHEN** 用户已启用生成结果自动保存并完成一次视频生成
- **THEN** 视频文件 SHALL 写入用户选择的目录，OPFS 输入缓存 SHALL 不新增该视频文件

