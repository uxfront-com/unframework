// UF6005 conflicting-members: two parts of an intersection give `label` different types;
// declare it once, or give both the same type.
export interface Labelled {
  label: string;
}

export interface Counted {
  label: number;
}

export default function Badge({ label }: Labelled & Counted) {
  return <span class="badge">{label}</span>;
}
