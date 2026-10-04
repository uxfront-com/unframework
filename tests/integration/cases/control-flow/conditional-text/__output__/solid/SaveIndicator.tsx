import { Show } from "solid-js";

export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
}

export default function SaveIndicator(props: SaveIndicatorProps) {
  return (
    <p class="save-indicator" role="status">
      <Show when={props.saving} fallback="Saved">
        <em>Saving</em>
      </Show>
      , {props.changes === 1 ? "1 change" : `${props.changes} changes`}
      <Show when={props.savedAt} fallback=" just now">
        <time datetime={props.savedAt}>{" at " + props.savedAt}</time>
      </Show>
    </p>
  );
}
