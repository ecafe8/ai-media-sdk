import { Playground } from "@/components/playground";
import { getClientPlaygroundModels } from "@/lib/playground/registry";
import { getConfiguredProviders } from "@/lib/playground/server";

export default function Page() {
  return (
    <Playground models={getClientPlaygroundModels(getConfiguredProviders())} />
  );
}
