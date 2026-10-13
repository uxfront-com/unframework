// UF3035 unknown-prop: a component takes the props it declares; `label` is misspelt `lable`, and
// the likely fix renames it.
function Field({ label }: { label: string }) {
  return (
    <label>
      {label} <input type="text" />
    </label>
  );
}

export default function Form() {
  return (
    <form aria-label="Profile">
      <Field lable="Name" />
    </form>
  );
}
