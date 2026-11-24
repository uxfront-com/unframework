import Heading from "./Heading";
import Status from "./Status";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Panel.uf.tsx.css";

export default function Panel(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  return (
    <section class={props.class ? `panel ${props.class}` : "panel"} data-uf-34db6205="" {...others}>
      <Heading big={true} text="Release" data-uf-34db6205="" />
      <Heading big={false} text="Notes" data-uf-34db6205="" />
      <Status busy={false} text="Save" data-uf-34db6205="" />
      <Status busy={true} text="Save" data-uf-34db6205="" />
    </section>
  );
}
