import { vFocusTrap } from "./vFocusTrap";
import { type JSX, Show, createSignal } from "solid-js";

export default function Settings(props: { class?: string; style?: JSX.CSSProperties }) {
  const [open, setOpen] = createSignal(false);

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
      style={props.style}
      {...scopeAttributes(props)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
