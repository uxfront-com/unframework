export interface FieldProps {
  name: string;
  label: string;
}

export default function Field({ name, label }: FieldProps) {
  return (
    <label>
      {label}
      <input name={name} />
    </label>
  );
}
