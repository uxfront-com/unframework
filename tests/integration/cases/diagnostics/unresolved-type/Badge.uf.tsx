// UF6001 unresolved-type: the props type names a type the module neither declares nor imports;
// declare it, or import it from the module that does.
export interface BadgeProps {
  label: string;
}

export default function Badge({ label }: BadgeProp) {
  return <span class="badge">{label}</span>;
}
