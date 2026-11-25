import Swatch from "./Swatch.uf.tsx";
import type { Tone } from "./types";

// Consumers of `Palette` import the shared type from it.
export type { Tone } from "./types";

export default function Palette({ tone }: { tone: Tone }) {
  return (
    <div class="palette">
      <Swatch tone={tone} />
    </div>
  );
}
