## ADDED Requirements

### Requirement: Aliyun adapter resolves oss:// temporary URLs automatically

The Aliyun Bailian provider adapter SHALL detect `ImageContent` or `VideoContent` URLs that use the `oss://` scheme anywhere in a request body and SHALL inject the `X-DashScope-OssResourceResolve: enable` header on the outgoing transport request. The header SHALL be absent when no `oss://` URL is present in the request, so requests carrying only `http:`/`https:`/`data:` URLs are unchanged. This covers image generation and edit (Qwen `multimodal-generation/generation`), Wan image async submission, HappyHorse video submission, and r2v/video-edit submission paths.

#### Scenario: oss:// image URL injects the resolution header

- **WHEN** an image generation or edit request carries an `ImageContent` whose `url` starts with `oss://`
- **THEN** the adapter SHALL send the request with `X-DashScope-OssResourceResolve: enable` in the transport headers

#### Scenario: https:// image URL does not inject the resolution header

- **WHEN** an image request carries only `https://` image URLs
- **THEN** the adapter SHALL NOT add the `X-DashScope-OssResourceResolve` header

#### Scenario: oss:// video media injects the resolution header

- **WHEN** a video submission carries a first-frame, reference-image, or input-video URL that starts with `oss://`
- **THEN** the adapter SHALL send the request with `X-DashScope-OssResourceResolve: enable` in the transport headers

#### Scenario: mixed oss:// and https:// URLs injects the resolution header

- **WHEN** a request carries at least one `oss://` URL alongside `https://` URLs
- **THEN** the adapter SHALL inject `X-DashScope-OssResourceResolve: enable` (the header is safe when present even if some URLs are standard)

#### Scenario: data: URL does not inject the resolution header

- **WHEN** an image request carries only `data:` URLs (base64 inlined)
- **THEN** the adapter SHALL NOT add the `X-DashScope-OssResourceResolve` header
