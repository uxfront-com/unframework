import { $, type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

type TagStates = { selected?: boolean; muted?: boolean };

export interface TagListProps {
  label: string;
  tags: string[];
  states: TagStates;
  extra?: string[];
}

export default component$<TagListProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, tags, states, extra, class: className, style, ...attributes }) => {
    const expanded = useSignal(false);

    const expand = $(() => {
      expanded.value = !expanded.value;
    });

    return (
      <div class={["tag-list", className]} {...scopeAttributes(attributes)} style={style}>
        <span class={["tag", tags, states, { "tag-open": Boolean(expanded.value) }]}>{label}</span>
        <span class={tags}>Plain</span>
        <span class={[extra, expanded.value ? ["tag-wide", "tag-tall"] : []]}>Extra</span>
        <button type="button" onClick$={expand}>
          Expand
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
