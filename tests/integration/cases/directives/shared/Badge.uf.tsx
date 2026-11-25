import { vMark } from "./mark.uf.ts";

export interface BadgeProps {
  label: string;
}

export default function Badge({ label }: BadgeProps) {
  return (
    <span class="badge" v-mark="badge">
      {label}
    </span>
  );
}
