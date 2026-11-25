import { clearedRef } from "./_unframework/clearedRef";
import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit, onSettled } from "solid-js";

export interface ProfileMenuEvents {
  onClosed?: () => void;
}

export default function ProfileMenu(
  props: ProfileMenuEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onClosed", "class");

  const [open, setOpen] = createState(false);
  let menu: HTMLDivElement | null = null;

  function onDocumentClick(event: MouseEvent) {
    const element = menu;
    if (open() && element && !element.contains(event.target as Node)) {
      setOpen(false);
      props.onClosed?.();
    }
  }

  onSettled(() => {
    document.addEventListener("click", onDocumentClick);
  });

  onSettled(() => () => {
    document.removeEventListener("click", onDocumentClick);
  });

  return (
    <section
      class={props.class ? `profile-menu ${props.class}` : "profile-menu"}
      aria-label="Profile"
      {...others}
    >
      <div
        class="menu"
        ref={clearedRef(
          (element_1) => {
            menu = element_1;
          },
          () => {
            menu = null;
          },
        )}
      >
        <button
          type="button"
          aria-expanded={enumeratedValue(open())}
          onClick={() => setOpen(!open())}
        >
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
