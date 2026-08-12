## ADDED Requirements

### Requirement: MiniMax scenario inputs extend the media fields

MiniMax-H3 的图生视频场景 SHALL 在首帧输入之外提供可选的尾帧单值图片输入，交互与首帧一致（URL 粘贴或本地上传，提交时映射为 `lastFrame`）。参考生视频场景 SHALL 提供可选的参考视频与参考音频输入，二者 SHALL 仅支持公网 URL（逗号分隔多条），MUST NOT 提供本地上传；条目数 SHALL 受模型注册表的参考视频/音频上限约束。场景切换 SHALL 使表单仅提交当前场景的输入。

#### Scenario: Last frame is optional and maps to lastFrame

- **WHEN** 体验者在图生视频场景填写尾帧输入并提交
- **THEN** 请求 SHALL 携带 `lastFrame`；未填写时 SHALL 不携带该字段

#### Scenario: Reference video/audio accept public URLs only

- **WHEN** 体验者在参考生视频场景填写参考视频或参考音频 URL
- **THEN** 提交时 SHALL 以有序公网 URL 列表传入 `referenceVideos`/`referenceAudios`，且界面无上传控件

#### Scenario: Scenario switch drops inactive inputs

- **WHEN** 体验者在文生视频与参考生视频之间切换后提交
- **THEN** 请求 SHALL 仅包含当前场景的媒体输入，不携带其他场景残留的媒体字段
