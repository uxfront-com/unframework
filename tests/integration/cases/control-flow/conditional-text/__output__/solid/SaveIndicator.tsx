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
      <Show keyed when={props.savedAt} fallback=" just now">
        {(savedAt) => <time datetime={savedAt}>{" at " + savedAt}</time>}
      </Show>
    </p>
  );
}
