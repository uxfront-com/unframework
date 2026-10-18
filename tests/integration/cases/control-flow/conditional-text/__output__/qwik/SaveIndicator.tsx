import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
}

export default component$<SaveIndicatorProps & { class?: ClassList; style?: CSSProperties }>(
  ({ saving, changes, savedAt, class: className, style }) => {
    return (
      <p class={["save-indicator", className]} role="status" style={style}>
        <>{saving ? <em>Saving</em> : "Saved"}</>,{" "}
        {changes === 1 ? "1 change" : `${changes} changes`}
        {savedAt ? <time dateTime={savedAt}>{" at " + savedAt}</time> : " just now"}
      </p>
    );
  },
);
