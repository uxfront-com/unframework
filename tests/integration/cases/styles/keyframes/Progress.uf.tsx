import "./Progress.css";

export default function Progress({ label }: { label: string }) {
  return (
    <div class="progress">
      <span class="dot" />
      <span>{label}</span>
    </div>
  );
}
