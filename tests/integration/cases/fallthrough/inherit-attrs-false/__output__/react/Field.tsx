export default function Field({ label }: { label: string }) {
  return (
    <label className="field">
      {label} <input name={label.toLowerCase()} />
    </label>
  );
}
