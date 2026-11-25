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
