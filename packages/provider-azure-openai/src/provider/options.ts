/**
 * Azure-native image generation options.
 *
 * These fields travel under the `providerOptions.azure` namespace and never
 * enter the public image contract. Field names mirror the live Azure AI
 * Serverless API for the `gpt-image-2` deployment.
 */

/**
 * Options forwarded into the Azure image generations request body under the
 * `providerOptions.azure` namespace.
 */
export interface AzureImageProviderOptions {
  /** Image quality hint, e.g. `low` or `high`. */
  readonly quality?: string;
  /** Output image format, e.g. `png` or `jpeg`. */
  readonly output_format?: string;
  /** Output compression level (0-100) when the format supports it. */
  readonly output_compression?: number;
}
