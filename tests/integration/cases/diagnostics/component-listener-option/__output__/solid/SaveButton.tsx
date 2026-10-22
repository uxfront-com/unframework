import type { JSX } from "solid-js";

export interface SaveButtonEvents {
  onSave?: () => void;
}

export function SaveButton(
  props: SaveButtonEvents & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <button
      type="button"
      onClick={() => props.onSave?.()}
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      Save
    </button>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
