import { type CSSProperties, type ClassList, Slot, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const open = useSignal(false);

    return (
      <div class={["disclosure", className]} {...scopeAttributes(attributes)} style={style}>
        <button
          type="button"
          aria-expanded={open.value}
          onClick$={() => (open.value = !open.value)}
        >
          Details
        </button>
        {open.value ? (
          <div class="body">
            <Slot />
          </div>
        ) : null}
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
