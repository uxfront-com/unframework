import { Transition } from "./_unframework/Transition";
import { vMark } from "./vMark";
import { type ComponentProps, type JSX, Show, createSignal } from "solid-js";
import "./Banner.uf.tsx.css";

export default function Banner(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [shown, setShown] = createSignal(true);

  return (
    <section aria-label="News" data-uf-53025c4a="" {...props}>
      <button type="button" onClick={() => setShown(false)} data-uf-53025c4a="">
        Dismiss
      </button>
      <Transition name="fade">
        <Show when={shown()}>
          <p class="banner" ref={vMark(() => "banner")} data-uf-53025c4a="">
            New releases are out.
          </p>
        </Show>
      </Transition>
    </section>
  );
}
