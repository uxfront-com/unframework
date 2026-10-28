import type { BadgeProps } from "./types";

export default function Badge({ label, tone = "info" }: BadgeProps) {
  return <span class={`badge badge-${tone}`}>{label}</span>;
}
