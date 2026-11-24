import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useId,
} from "@qwik.dev/core";

export interface FieldProps {
  label: string;
  hint: string;
}

export default component$<
  FieldProps &
    Omit<PropsOf<"p">, "label" | "hint" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, hint, class: className, style, ...attributes }) => {
  const inputId = "uf-id-" + useId();
  const hintId = "uf-id-" + useId();

  return (
    <p class={["field", className]} style={style} {...attributes}>
      <label for={inputId}>{label}</label>
      <input id={inputId} type="text" aria-describedby={hintId} />
      <small id={hintId}>{hint}</small>
    </p>
  );
});
