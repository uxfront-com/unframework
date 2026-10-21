import { For, type JSX, createSignal, createUniqueId } from "solid-js";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

export default function SizePicker(
  props: SizePickerProps & { class?: string; style?: JSX.CSSProperties },
) {
  const group = `uf-id-${createUniqueId()}`;
  const hintId = `uf-id-${createUniqueId()}`;
  const [picked, setPicked] = createSignal("");

  function choose(size: string) {
    setPicked(size);
  }

  return (
    <fieldset
      class={props.class ? `size-picker ${props.class}` : "size-picker"}
      aria-describedby={hintId}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <legend>{props.legend}</legend>
      <p id={hintId}>Pick one size.</p>
      <For each={props.sizes}>
        {(size, index) => (
          <div class="size">
            <input
              type="radio"
              id={`${group}-${index()}`}
              name={group}
              value={size}
              onChange={() => choose(size)}
            />
            <label for={`${group}-${index()}`}>{size}</label>
          </div>
        )}
      </For>
      <output>{picked() || "none"}</output>
    </fieldset>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
