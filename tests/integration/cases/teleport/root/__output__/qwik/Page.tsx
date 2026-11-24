import Toast from "./Toast";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Page.uf.tsx.css?inline";

export interface PageProps {
  message: string;
}

export default component$<
  PageProps &
    Omit<PropsOf<"section">, "message" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ message, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <section
      class={["page", className]}
      aria-label="Page"
      data-uf-5a3bed67=""
      style={style}
      {...attributes}
    >
      <p data-uf-5a3bed67="">Saving…</p>
      <Toast message={message} data-uf-5a3bed67="" />
    </section>
  );
});
