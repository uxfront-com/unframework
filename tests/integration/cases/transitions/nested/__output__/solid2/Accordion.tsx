import { Transition } from "./_unframework/Transition";
import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show } from "solid-js";
import "./Accordion.uf.tsx.css";

export default function Accordion(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [open, setOpen] = createState(true);

  return (
    <section aria-label="Shipping" data-uf-357b6b1f="" {...props}>
      <button
        type="button"
        aria-expanded={enumeratedValue(open())}
        onClick={() => setOpen(!open())}
        data-uf-357b6b1f=""
      >
        Shipping
      </button>
      <Transition name="outer">
        <Show when={open()}>
          <div class="panel" data-uf-357b6b1f="">
            <Transition name="inner">
              <p class="note" data-uf-357b6b1f="">
                Ships in two days.
              </p>
            </Transition>
          </div>
        </Show>
      </Transition>
    </section>
  );
}
