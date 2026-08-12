import { useTranslation } from "react-i18next";

import { PROVIDER_LABELS, type SiteProvider } from "@/lib/key-store";
import type { SitePlaygroundResponse } from "@/lib/playground/types";

/**
 * UI-layer localization of playground errors. Lib/SDK layers emit stable
 * codes and English fallback messages; this hook renders the localized
 * text for the current language.
 */

export type SiteErrorInfo = NonNullable<SitePlaygroundResponse["error"]>;

export function useErrorText(): (
  error: SiteErrorInfo | undefined,
  provider?: SiteProvider
) => string {
  const { t } = useTranslation();

  return (error, provider) => {
    if (!error) return t("playground.result.failedDefault");
    switch (error.code) {
      case "INVALID_REQUEST":
        return error.detail
          ? t("errors.INVALID_REQUEST_DETAIL", { detail: error.detail })
          : t("errors.INVALID_REQUEST");
      case "PROVIDER_ERROR":
        return error.detail
          ? t("errors.PROVIDER_ERROR_DETAIL", { detail: error.detail })
          : t("errors.PROVIDER_ERROR");
      case "UNKNOWN_MODEL":
        return error.detail ?? t("errors.UNKNOWN_MODEL");
      case "CONFIGURATION_ERROR":
        return t("errors.CONFIGURATION_ERROR", {
          provider: provider ? PROVIDER_LABELS[provider] : "",
          detail: error.detail ?? "",
        });
      case "ENDPOINT_MISSING_FIELD":
        return t("errors.ENDPOINT_MISSING_FIELD", {
          field: error.context?.field ?? "",
        });
      case "ENDPOINT_INVALID":
        return t("errors.ENDPOINT_INVALID", {
          field: error.context?.field ?? "",
          detail: endpointReasonText(error.context?.reason),
        });
      case "ENDPOINT_UNCONFIRMED":
        return t("errors.ENDPOINT_UNCONFIRMED", {
          host: error.context?.host ?? "",
        });
      case "AUTH_ERROR":
        return t("errors.AUTH_ERROR");
      case "RATE_LIMITED":
        return t("errors.RATE_LIMITED");
      case "TIMEOUT":
        return t("errors.TIMEOUT");
      case "NETWORK_ERROR":
        return t("errors.NETWORK_ERROR");
      case "NOT_IMPLEMENTED":
        return t("errors.NOT_IMPLEMENTED");
      case "VALIDATION_ERROR":
        return t("errors.VALIDATION_ERROR");
      case "MODEL_UNAVAILABLE":
        return t("errors.MODEL_UNAVAILABLE");
      case "EDIT_NOT_SUPPORTED":
        return t("errors.EDIT_NOT_SUPPORTED");
      case "VIDEO_NOT_SUPPORTED":
        return t("errors.VIDEO_NOT_SUPPORTED");
      case "VIDEO_PROVIDER_UNSUPPORTED":
        return t("errors.VIDEO_PROVIDER_UNSUPPORTED");
      case "FIRST_FRAME_REQUIRED":
        return t("errors.FIRST_FRAME_REQUIRED");
      case "INPUT_VIDEO_REQUIRED":
        return t("errors.INPUT_VIDEO_REQUIRED");
      case "UNKNOWN":
        return t("errors.generic");
      default:
        return t("errors.generic");
    }
  };

  function endpointReasonText(reason: string | undefined): string {
    switch (reason) {
      case "EMPTY":
        return t("errors.endpoint.EMPTY");
      case "NOT_URL":
        return t("errors.endpoint.NOT_URL");
      case "NOT_HTTPS":
        return t("errors.endpoint.NOT_HTTPS");
      case "HAS_CREDENTIALS":
        return t("errors.endpoint.HAS_CREDENTIALS");
      case "NON_STANDARD_PORT":
        return t("errors.endpoint.NON_STANDARD_PORT");
      default:
        return reason ?? "";
    }
  }
}
