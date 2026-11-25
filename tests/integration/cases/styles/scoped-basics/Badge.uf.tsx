import "./Badge.css";

export default function Badge({ label, count }: { label: string; count: number }) {
  return (
    <span class="badge">
      <span class="label">{label}</span>
      <span class="count">{count}</span>
    </span>
  );
}
