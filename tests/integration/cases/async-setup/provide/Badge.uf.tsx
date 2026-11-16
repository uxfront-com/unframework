import { inject } from "@uxfront/unframework";
import type { InjectionKey } from "@uxfront/unframework";

export const ToneKey: InjectionKey<string> = Symbol("uf.tone");

// A child that reads what its async parent provides.
export default function Badge() {
  const tone = inject(ToneKey, "plain");
  return <span class="badge">Tone: {tone}</span>;
}
