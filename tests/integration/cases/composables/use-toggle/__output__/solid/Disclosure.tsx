import { useToggle } from "./useToggle";
import { type JSX, Show } from "solid-js";

export default function Disclosure(props: { class?: string; style?: JSX.CSSProperties }) {
  const { on, toggle, close } = useToggle(false);

  return (
    <section
      class={props.class ? `disclosure ${props.class}` : "disclosure"}
      aria-label="Shipping"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <button type="button" aria-expanded={on()} onClick={() => toggle()}>
        Shipping details
      </button>
      <Show when={on()}>
        <div class="panel">
          <p>Orders ship within two days.</p>
          <button type="button" onClick={() => close()}>
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
