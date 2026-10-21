// UF5002 invalid-stylesheet: the component's stylesheet does not parse as CSS.
import "./Badge.css";

export default function Badge({ label }: { label: string }) {
  return <span class="badge">{label}</span>;
}
