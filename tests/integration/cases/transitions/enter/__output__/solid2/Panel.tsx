import { Transition } from "./_unframework/Transition";
import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";
import "./Panel.uf.tsx.css";

export default function Panel(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [open, setOpen] = createState(false);

  return (
    <section
      class={props.class ? `panel ${props.class}` : "panel"}
      aria-label="Delivery"
      data-uf-eab7eeb4=""
      {...others}
    >
      <button
        type="button"
        aria-expanded={enumeratedValue(open())}
        onClick={() => setOpen(!open())}
        data-uf-eab7eeb4=""
      >
        Details
      </button>
      <Transition name="v">
        <Show when={open()}>
          <p class="details" data-uf-eab7eeb4="">
            Ships in two days.
          </p>
        </Show>
      </Transition>
    </section>
  );
}
