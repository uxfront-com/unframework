// UF1002 unsupported-syntax: a component whose root is an SVG element takes its namespace from
// its parent, which lands in M8.
export interface ChipProps {
  label: string;
}

export default function Chip({ label }: ChipProps) {
  return <text class="chip">{label}</text>;
}
