import { badge } from "virtual:styleframe";

import "virtual:styleframe.css";

export default function Badge({ label }: { label: string }) {
  return <span class={badge()}>{label}</span>;
}
