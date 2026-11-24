import { Transition } from "./_unframework/Transition";
import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";
import "./Panel.uf.tsx.css";

export default function Panel(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [open, setOpen] = createSignal(false);

  return (
    <section
      class={props.class ? `panel ${props.class}` : "panel"}
      aria-label="Delivery"
      data-uf-eab7eeb4=""
      {...others}
    >
      <button
        type="button"
        aria-expanded={open()}
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
