import Field from "./Field.uf.tsx";

export default function Form() {
  return (
    <form aria-label="Sign up">
      <Field label="Email" />
      <Field label="Name" />
    </form>
  );
}
