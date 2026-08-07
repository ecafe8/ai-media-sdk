import { Playground } from "@/components/playground";
import { getClientPlaygroundModels } from "@/lib/playground/registry";
import { getConfiguredProviders } from "@/lib/playground/server";

/**
 * The configured-Provider set is derived from runtime environment variables.
 * Force dynamic rendering so the flag is computed per request (e.g. on
 * Vercel, where env may be absent) instead of baked into the static build.
 */
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Playground models={getClientPlaygroundModels(getConfiguredProviders())} />
  );
}
