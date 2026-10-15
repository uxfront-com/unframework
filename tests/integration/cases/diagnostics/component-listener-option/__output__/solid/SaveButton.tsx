import type { JSX } from "solid-js";

export interface SaveButtonEvents {
  onSave?: () => void;
}

export function SaveButton(
  props: SaveButtonEvents & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <button type="button" onClick={() => props.onSave?.()} class={props.class} style={props.style}>
      Save
    </button>
  );
}
