// UF2001 invalid-props: a default on a required prop; make the prop optional or drop the default.
export interface BadgeProps {
  label: string;
}

export default function Badge({ label = "New" }: BadgeProps) {
  return <span class="badge">{label}</span>;
}
