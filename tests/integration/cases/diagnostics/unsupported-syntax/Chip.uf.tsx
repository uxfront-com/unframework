// UF1002 unsupported-syntax: a rest element in the props pattern is fallthrough, which lands in M3.
export interface ChipProps {
  label: string;
  title?: string;
}

export default function Chip({ label, ...rest }: ChipProps) {
  return <span class="chip">{label}</span>;
}
