export default function Card({ label }: { label: string }) {
  return (
    <div class="card">
      <strong>{label}</strong>
    </div>
  );
}
