import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useId,
} from "@qwik.dev/core";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export default component$<
  EmailFieldProps &
    Omit<PropsOf<"div">, "label" | "hint" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, hint, class: className, style, ...attributes }) => {
  const inputId = "uf-id-" + useId();
  const hintId = "uf-id-" + useId();

  return (
    <div class={["email-field", className]} style={style} {...attributes}>
      <label for={inputId}>{label}</label>
      <input id={inputId} name="email" type="email" aria-describedby={hintId} />
      <p id={hintId}>{hint}</p>
    </div>
  );
});
