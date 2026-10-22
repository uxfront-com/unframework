import { type CSSProperties, type ClassList, type QRL, component$ } from "@qwik.dev/core";

export interface SaveButtonEvents {
  onSave$?: QRL<() => void>;
}

export const SaveButton = component$<
  SaveButtonEvents & { class?: ClassList; style?: CSSProperties }
>(({ onSave$, class: className, style, ...attributes }) => {
  return (
    <button
      type="button"
      onClick$={() => onSave$?.()}
      {...scopeAttributes(attributes)}
      class={className}
      style={style}
    >
      Save
    </button>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
