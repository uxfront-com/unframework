import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
}

export default component$<
  SaveIndicatorProps &
    Omit<PropsOf<"p">, "saving" | "changes" | "savedAt" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ saving, changes, savedAt, class: className, style, ...attributes }) => {
  return (
    <p class={["save-indicator", className]} role="status" style={style} {...attributes}>
      <>{saving ? <em>Saving</em> : "Saved"}</>, {changes === 1 ? "1 change" : `${changes} changes`}
      {savedAt ? <time dateTime={savedAt}>{" at " + savedAt}</time> : " just now"}
    </p>
  );
});
