// UF3035 unknown-prop: a component takes the props it declares, and what falls through to its root
// (ADR-0118); `label` is misspelt `lable`, which is no attribute of the root <label> either, and
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
