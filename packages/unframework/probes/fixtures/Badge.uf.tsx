import type { BadgeProps } from "./types.ts";

export default function Badge({ label, tone = "neutral", count }: BadgeProps) {
  return (
    <span class={["badge", `badge--${tone}`]}>
      {label}
      {count === undefined ? null : <b>{count}</b>}
    </span>
  );
}
