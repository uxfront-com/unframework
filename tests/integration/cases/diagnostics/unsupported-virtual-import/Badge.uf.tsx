// UF5006 unsupported-styleframe-import: a Styleframe recipe is called outside a `class`.
import { badge } from "virtual:styleframe";

export default function Badge({ label }: { label: string }) {
  return <span title={badge()}>{label}</span>;
}
