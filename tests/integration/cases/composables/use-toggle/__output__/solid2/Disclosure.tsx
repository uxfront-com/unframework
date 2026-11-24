import { enumeratedValue } from "./_unframework/enumeratedValue";
import { useToggle } from "./useToggle";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export default function Disclosure(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const { on, toggle, close } = useToggle(false);

  return (
    <section
      class={props.class ? `disclosure ${props.class}` : "disclosure"}
      aria-label="Shipping"
      {...others}
    >
      <button type="button" aria-expanded={enumeratedValue(on())} onClick={() => toggle()}>
        Shipping details
      </button>
      <Show when={on()}>
        <div class="panel">
          <p>Orders ship within two days.</p>
          <button type="button" onClick={() => close()}>
            Close
          </button>
        </div>
      </Show>
    </section>
  );
}
