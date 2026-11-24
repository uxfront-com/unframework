import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export type ButtonTone = "primary" | "secondary";

export type ButtonSize = "small" | "large";

export interface ButtonProps {
  label: string;
  tone?: ButtonTone;
}

export default component$<
  ButtonProps &
    Omit<PropsOf<"button">, "label" | "tone" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, tone = "primary", class: className, style, ...attributes }) => {
  return (
    <button
      type="button"
      class={[`button button-${tone}`, className]}
      style={style}
      {...attributes}
    >
      {label}
    </button>
  );
});
