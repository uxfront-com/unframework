import Action from "./Action";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export default function Page(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [linked, setLinked] = createSignal(true);

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
