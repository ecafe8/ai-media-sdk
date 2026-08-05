## MODIFIED Requirements

### Requirement: Aliyun video adapter submits async tasks to the video-synthesis endpoint

The Aliyun adapter `submit()` SHALL route `video`-modality requests to `POST {baseUrl}/services/aigc/video-generation/video-synthesis` with `X-DashScope-Async: enable`, `Authorization: Bearer {apiKey}`, and `Content-Type: application/json`. It SHALL read `output.task_id` + `output.task_status` from the submit response and return a `TaskHandle<VideoContent[]>` whose poll closure polls the shared `GET /tasks/{task_id}` endpoint. The API key SHALL NOT appear in messages or `cause`.

#### Scenario: Submit request targets the video-synthesis path with the async header

- **WHEN** `submit()` builds a video generation request for a configured `baseUrl` and API key
- **THEN** the `TransportRequest` SHALL target `/services/aigc/video-generation/video-synthesis`, carry the `X-DashScope-Async: enable` and `Authorization: Bearer` headers, and contain a `model` + `input` body

#### Scenario: Unknown video model id is rejected

- **WHEN** `provider.image("not-a-real-video-model")` is called
- **THEN** it SHALL throw an `SdkError` with code `UNKNOWN_MODEL` and SHALL not send a request
