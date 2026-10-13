export function Field({ label }: { label: string }) {
  return (
    <label>
      {label} <input type="text" />
    </label>
  );
}
