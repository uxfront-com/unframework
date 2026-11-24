import Toast from "./Toast";
import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "./Page.uf.tsx.css";

export interface PageProps {
  message: string;
}

export default function Page(
  props: PageProps &
    Omit<ComponentProps<"section">, "message" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["message", "class"]);

  return (
    <section
      class={props.class ? `page ${props.class}` : "page"}
      aria-label="Page"
      data-uf-5a3bed67=""
      {...others}
    >
      <p data-uf-5a3bed67="">Saving…</p>
      <Toast message={props.message} data-uf-5a3bed67="" />
    </section>
  );
}
