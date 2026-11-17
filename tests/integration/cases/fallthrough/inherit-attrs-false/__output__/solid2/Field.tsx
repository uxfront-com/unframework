export default function Field(props: { label: string }) {
  return (
    <label class="field">
      {props.label} <input name={props.label.toLowerCase()} />
    </label>
  );
}
