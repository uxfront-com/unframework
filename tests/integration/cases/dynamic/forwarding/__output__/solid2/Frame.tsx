import Card from "./Card";
import Panel from "./Panel";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface FrameSlots {
  title?: JSX.Element;
}

export default function Frame(
  props: { label: string; wide: boolean } & FrameSlots &
    Omit<ComponentProps<"section">, "label" | "wide" | "title" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "wide", "title", "class");

  return (
    <section
      class={props.class ? `frame ${props.class}` : "frame"}
      aria-label={props.label}
      {...others}
    >
      <Dynamic component={props.wide ? Panel : Card} title={props.title} />
    </section>
  );
}
