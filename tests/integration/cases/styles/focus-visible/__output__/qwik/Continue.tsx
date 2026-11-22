import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Continue.uf.tsx.css?inline";

export default component$<
  { text: string } & Omit<PropsOf<"button">, "text" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <button
      type="button"
      class={["continue", className]}
      data-uf-bb3adc28=""
      style={style}
      {...attributes}
    >
      {text}
    </button>
  );
});
