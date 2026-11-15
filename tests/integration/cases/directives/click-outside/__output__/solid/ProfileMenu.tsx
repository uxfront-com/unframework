import { vClickOutside } from "./vClickOutside";
import { type JSX, Show, createSignal } from "solid-js";

export interface ProfileMenuEvents {
  onClosed?: () => void;
}

export default function ProfileMenu(
  props: ProfileMenuEvents & { class?: string; style?: JSX.CSSProperties },
) {
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
      style={props.style}
      {...scopeAttributes(props)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
