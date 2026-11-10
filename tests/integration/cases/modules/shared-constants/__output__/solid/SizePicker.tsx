import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
import { For, type JSX, createSignal } from "solid-js";

export default function SizePicker(props: { class?: string; style?: JSX.CSSProperties }) {
  const [size, setSize] = createSignal<Size>(DEFAULT_SIZE);

  function pick(next: Size) {
    setSize(next);
  }

  return (
    <fieldset
      class={props.class ? `size-picker ${props.class}` : "size-picker"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <legend>Size</legend>
      <p role="status">Picked: {SIZES[size()]}</p>
      <ul>
        <For each={SIZE_ORDER}>
          {(each) => (
            <li>
              <button type="button" aria-pressed={size() === each} onClick={() => pick(each)}>
                {SIZES[each]}
              </button>
            </li>
          )}
        </For>
      </ul>
    </fieldset>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
