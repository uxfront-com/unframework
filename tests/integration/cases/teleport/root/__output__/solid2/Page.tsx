import Toast from "./Toast";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Page.uf.tsx.css";

export interface PageProps {
  message: string;
}

export default function Page(
  props: PageProps &
    Omit<ComponentProps<"section">, "message" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "message", "class");

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
