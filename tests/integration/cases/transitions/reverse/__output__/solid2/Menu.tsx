import { Transition } from "./_unframework/Transition";
import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";
import "./Menu.uf.tsx.css";

export default function Menu(
  props: Omit<ComponentProps<"nav">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [open, setOpen] = createState(true);
  const [refreshes, setRefreshes] = createState(0);

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
      <button
        type="button"
        aria-expanded={enumeratedValue(open())}
        onClick={refresh}
        data-uf-e688a71a=""
      >
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
