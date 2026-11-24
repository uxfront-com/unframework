import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Action.uf.tsx.css?inline";

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
      class={["action", className]}
      data-uf-6173c12c=""
      style={style}
      {...attributes}
    >
      {text}
    </button>
  );
});
