import Action from "./Action";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Page(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [linked, setLinked] = createState(true);

  return (
    <section class={props.class ? `page ${props.class}` : "page"} {...others}>
      <Action href="#docs" label="Docs">
        Read the docs
      </Action>
      <Action label="Save">Save the draft</Action>
      <Action href="#home" label="Home" />
      <Action label="Close" />
      <Action href={linked() ? "#more" : undefined} label="More" icon={<i aria-hidden="true">+</i>}>
        Learn more
      </Action>
      <button type="button" onClick={() => setLinked(!linked())}>
        Toggle
      </button>
    </section>
  );
}
