import { createState } from "./_unframework/createState";
import { vFocusTrap } from "./vFocusTrap";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export default function Settings(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [open, setOpen] = createState(false);

  function close() {
    setOpen(false);
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") close();
  }

  return (
    <section
      class={props.class ? `settings ${props.class}` : "settings"}
      aria-label="Settings"
      {...others}
    >
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Show when={open()}>
        <div
          role="dialog"
          aria-label="Preferences"
          tabindex="-1"
          class="dialog"
          ref={vFocusTrap(() => open())}
          onKeyDown={onKeydown}
        >
          <button type="button">Theme</button>
          <button type="button">Language</button>
          <button type="button" onClick={close}>
            Close
          </button>
        </div>
      </Show>
    </section>
  );
}
