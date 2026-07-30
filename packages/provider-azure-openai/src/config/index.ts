/**
 * Azure OpenAI Provider configuration boundary.
 *
 * Azure OpenAI uses API Key authentication (`api-key` header) and a
 * synchronous image API. Phase 0 only defines the configuration shape; it
 * never reads credentials or performs a network call.
 */
export interface AzureOpenAIConfig {
  /** API key sent via the `api-key` header. */
  readonly apiKey: string;
  /** Azure resource endpoint, e.g. `https://<resource>.cognitiveservices.azure.com`. */
  readonly endpoint: string;
  /** Azure OpenAI API version, e.g. `2024-10-01`. */
  readonly apiVersion: string;
}
