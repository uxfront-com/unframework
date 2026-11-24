import { Transition } from "./_unframework/Transition";
import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";
import "./Menu.uf.tsx.css";

export default function Menu(
  props: Omit<ComponentProps<"nav">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [open, setOpen] = createSignal(true);

  return (
    <nav
      class={props.class ? `menu ${props.class}` : "menu"}
      aria-label="Account"
      data-uf-e688a71a=""
      {...others}
    >
      <button
        type="button"
        aria-expanded={open()}
        onClick={() => setOpen(!open())}
        data-uf-e688a71a=""
      >
        Account
      </button>
      <Transition name="fade">
        <Show when={open()}>
          <ul class="items" data-uf-e688a71a="">
            <li data-uf-e688a71a="">Profile</li>
            <li data-uf-e688a71a="">Sign out</li>
          </ul>
        </Show>
      </Transition>
    </nav>
  );
}
