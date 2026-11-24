import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Tag.uf.tsx.css?inline";

export default component$<
  { name: string } & Omit<PropsOf<"span">, "name" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ name, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <span class={["tag", className]} data-uf-ef5e671c="" style={style} {...attributes}>
      {name}
    </span>
  );
});
