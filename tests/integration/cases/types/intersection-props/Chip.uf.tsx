import type { Sized, Toned } from "./types";

type ChipProps = Sized & Toned & { label: string };

export default function Chip({ size, tone = "neutral", label }: ChipProps) {
  return <span class={`chip chip-${size} chip-${tone}`}>{label}</span>;
}
