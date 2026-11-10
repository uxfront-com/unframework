// UF1204 framework-in-shared-module: the shared module `tokens.ts` imports `palette.ts`, which
// imports React. Every output tree holds a copy of both, so the component compiles for no target.
import { tones } from "./tokens.ts";

export default function Badge({ tone }: { tone: "info" | "danger" }) {
  return <span class="badge">{tones[tone]}</span>;
}
