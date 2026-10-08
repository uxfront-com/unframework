export default function Tag({ label }: { label: string }) {
  return (
    <span className="tag" style={{ padding: "2px 6px", color: "rgb(30, 30, 30)" }}>
      {label}
    </span>
  );
}
