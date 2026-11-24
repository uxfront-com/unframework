import { Transition } from "./_unframework/Transition";
import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";
import "./Menu.uf.tsx.css";

export default function Menu(
  props: Omit<ComponentProps<"nav">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [open, setOpen] = createSignal(true);
  const [refreshes, setRefreshes] = createSignal(0);

  function refresh() {
    setRefreshes(refreshes() + 1);
    setOpen(false);
    setTimeout(() => {
      setOpen(true);
    }, 80);
  }

  return (
    <nav
      class={props.class ? `menu ${props.class}` : "menu"}
      aria-label="Account"
      data-uf-e688a71a=""
      {...others}
    >
      <button type="button" aria-expanded={open()} onClick={refresh} data-uf-e688a71a="">
        Refresh
      </button>
      <p role="status" data-uf-e688a71a="">
        Refreshes: {refreshes()}
      </p>
      <Transition name="fade">
        <Show when={open()}>
          <ul class="items" data-uf-e688a71a="">
            <li data-uf-e688a71a="">Profile</li>
          </ul>
        </Show>
      </Transition>
    </nav>
  );
}
