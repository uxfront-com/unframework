export default function Card(props: { label: string }) {
  return (
    <div class="card">
      <strong>{props.label}</strong>
    </div>
  );
}
