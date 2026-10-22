import Tag from "./Tag";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const active = useSignal(false);

    return (
      <div class={["tags", className]} {...scopeAttributes(attributes)} style={style}>
        <Tag label="plain" />
        <Tag label="wide" class={["wide"]} style={{ marginLeft: "8px" }} />
        <Tag
          label="toggled"
          class={["picked", { active: Boolean(active.value) }]}
          style={{ color: active.value ? "rgb(200, 0, 0)" : undefined }}
        />
        <button type="button" onClick$={() => (active.value = !active.value)}>
          Toggle
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
