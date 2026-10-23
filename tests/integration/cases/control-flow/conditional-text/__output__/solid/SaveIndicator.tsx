import { type JSX, Show } from "solid-js";

export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
}

export default function SaveIndicator(
  props: SaveIndicatorProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <p
      class={props.class ? `save-indicator ${props.class}` : "save-indicator"}
      role="status"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Show when={props.saving} fallback="Saved">
        <em>Saving</em>
      </Show>
      , {props.changes === 1 ? "1 change" : `${props.changes} changes`}
      <Show when={props.savedAt} fallback=" just now">
        {(savedAt) => <time datetime={savedAt()}>{" at " + savedAt()}</time>}
      </Show>
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
