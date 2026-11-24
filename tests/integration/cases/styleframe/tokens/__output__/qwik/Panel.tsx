import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import "virtual:styleframe.css";
import styles from "./Panel.uf.tsx.css?inline";

export default component$<
  { text: string } & Omit<PropsOf<"section">, "text" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <section class={["panel", className]} data-uf-b6be1fd3="" style={style} {...attributes}>
      <p class="body" data-uf-b6be1fd3="">
        {text}
      </p>
    </section>
  );
});
