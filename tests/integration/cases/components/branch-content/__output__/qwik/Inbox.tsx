import Notice from "./Notice";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ unread: number } & { class?: ClassList; style?: CSSProperties }>(
  ({ unread, class: className, style, ...attributes }) => {
    const count = useSignal(unread);

    return (
      <div class={["inbox", className]} {...scopeAttributes(attributes)} style={style}>
        <>
          {count.value > 0 ? (
            <Notice text={`${count.value} unread`} tone="info" />
          ) : (
            <Notice text="All read" tone="quiet" />
          )}
        </>
        <button type="button" onClick$={() => (count.value = 0)}>
          Mark all read
        </button>
      </div>
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
