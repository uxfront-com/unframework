import Picker from "./Picker";
import { vTrace } from "./vTrace";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Page(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  return (
    <section class={props.class ? `page ${props.class}` : "page"} aria-label="Page" {...others}>
      <Picker
        option={({ option }) => (
          <span data-name={`option-${option.id}`} ref={vTrace(() => option.label)}>
            {option.label}
          </span>
        )}
      />
    </section>
  );
}
