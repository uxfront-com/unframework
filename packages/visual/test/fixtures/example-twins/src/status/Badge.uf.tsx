export default function Badge({ level = "low" }: { level?: "low" | "high" }) {
  return <i data-status={level}>{level}</i>;
}
