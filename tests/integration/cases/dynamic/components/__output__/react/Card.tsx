export default function Card({ label }: { label: string }) {
  return (
    <div className="card">
      <strong>{label}</strong>
    </div>
  );
}
