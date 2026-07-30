/**
 * Azure OpenAI Provider configuration boundary.
 *
 * Azure OpenAI uses API Key authentication sent as `Authorization: Bearer
 * {apiKey}` (live-confirmed for Global Standard `gpt-image-2` deployments) and
 * a synchronous image API. The configuration only defines the shape; it never
 * reads credentials until an adapter request is executed.
 */
export interface AzureOpenAIConfig {
  /** API key sent as the `Authorization: Bearer` credential. */
  readonly apiKey: string;
  /** Azure resource endpoint, e.g. `https://<resource>.cognitiveservices.azure.com`. */
  readonly endpoint: string;
  /** Azure OpenAI API version, e.g. `2024-02-01`. */
  readonly apiVersion: string;
}
