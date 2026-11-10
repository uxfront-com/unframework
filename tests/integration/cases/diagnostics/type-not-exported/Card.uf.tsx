// UF6003 type-not-exported: the props type comes from another module, and the type of `icon`
// names `Icon`, which that module declares without `export`; export it.
import type { CardProps } from "./types.ts";

export default function Card({ title }: CardProps) {
  return <h2 class="card">{title}</h2>;
}
