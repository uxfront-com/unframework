import { Transition } from "./_unframework/Transition";
import { createState } from "./_unframework/createState";
import { vMark } from "./vMark";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show } from "solid-js";
import "./Banner.uf.tsx.css";

export default function Banner(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [shown, setShown] = createState(true);

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
