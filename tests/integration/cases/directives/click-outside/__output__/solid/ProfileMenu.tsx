import { vClickOutside } from "./vClickOutside";
import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";

export interface ProfileMenuEvents {
  onClosed?: () => void;
}

export default function ProfileMenu(
  props: ProfileMenuEvents &
    Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["onClosed", "class"]);

  const [open, setOpen] = createSignal(false);

  function close() {
    if (!open()) return;
    setOpen(false);
    props.onClosed?.();
  }

  return (
    <section
      class={props.class ? `profile-menu ${props.class}` : "profile-menu"}
      aria-label="Profile"
      {...others}
    >
      <div class="menu" ref={vClickOutside(() => close)}>
        <button type="button" aria-expanded={open()} onClick={() => setOpen(!open())}>
          Account
        </button>
        <Show when={open()}>
          <ul aria-label="Account actions">
            <li>
              <button type="button">Settings</button>
            </li>
            <li>
              <button type="button">Sign out</button>
            </li>
          </ul>
        </Show>
      </div>
      <p>Outside the menu</p>
    </section>
  );
}
