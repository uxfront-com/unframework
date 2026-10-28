import type { Tone } from "./types";

export default function Swatch({ tone }: { tone: Tone }) {
  return <span class={`swatch swatch-${tone}`}>{tone}</span>;
}
