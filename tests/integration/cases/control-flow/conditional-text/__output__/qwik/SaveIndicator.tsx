import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
}

export default component$<SaveIndicatorProps & { class?: ClassList; style?: CSSProperties }>(
  ({ saving, changes, savedAt, class: className, style, ...attributes }) => {
    return (
      <p
        class={["save-indicator", className]}
        role="status"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <>{saving ? <em>Saving</em> : "Saved"}</>,{" "}
        {changes === 1 ? "1 change" : `${changes} changes`}
        {savedAt ? <time dateTime={savedAt}>{" at " + savedAt}</time> : " just now"}
      </p>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
