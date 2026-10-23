// UF5006 unsupported-virtual-import: a name a pass-through import binds is called outside a `class`.
import { badge } from "virtual:recipes";

export default function Badge({ label }: { label: string }) {
  return <span title={badge()}>{label}</span>;
}
