import Card from "./Card";
import Panel from "./Panel";
import { type ComponentProps, type JSX, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export interface FrameSlots {
  title?: JSX.Element;
}

export default function Frame(
  props: { label: string; wide: boolean } & FrameSlots &
    Omit<ComponentProps<"section">, "label" | "wide" | "title" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "wide", "title", "class"]);

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
