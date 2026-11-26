import { Transition } from "./_unframework/Transition";
import { type ComponentProps, type JSX, Show, createSignal } from "solid-js";
import "./Drawer.uf.tsx.css";

export default function Drawer(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [shown, setShown] = createSignal(true);
  const [open, setOpen] = createSignal(true);

  return (
    <section aria-label="Filters" data-uf-54e3e959="" {...props}>
      <button type="button" onClick={() => setShown(!shown())} data-uf-54e3e959="">
        Drawer
      </button>
      <button type="button" onClick={() => setOpen(!open())} data-uf-54e3e959="">
        Body
      </button>
      <Show when={shown()}>
        <Transition name="fade">
          <Show when={open()}>
            <p class="body" data-uf-54e3e959="">
              Colour, size
            </p>
          </Show>
        </Transition>
      </Show>
    </section>
  );
}
