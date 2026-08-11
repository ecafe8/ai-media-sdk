import { Playground } from "@/components/playground";
import { SITE_MODELS } from "@/lib/playground/registry";

export function PlaygroundPage() {
  return <Playground models={SITE_MODELS} />;
}
