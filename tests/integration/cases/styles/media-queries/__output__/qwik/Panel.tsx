import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Panel.uf.tsx.css?inline";

export default component$<
  { text: string } & Omit<PropsOf<"aside">, "text" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <aside class={["panel", className]} data-uf-48dda3f4="" style={style} {...attributes}>
      <p class="text" data-uf-48dda3f4="">
        {text}
      </p>
    </aside>
  );
});
