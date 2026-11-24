import { Transition } from "./_unframework/Transition";
import { type ComponentProps, type JSX, Show, createSignal } from "solid-js";
import "./Accordion.uf.tsx.css";

export default function Accordion(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [open, setOpen] = createSignal(true);

  return (
    <section aria-label="Shipping" data-uf-357b6b1f="" {...props}>
      <button
        type="button"
        aria-expanded={open()}
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
