export function Field(props: { label: string }) {
  return (
    <label>
      {props.label} <input type="text" />
    </label>
  );
}
