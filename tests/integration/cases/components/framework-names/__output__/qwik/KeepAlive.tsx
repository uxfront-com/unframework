import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

const KeepAlive = component$<{ level: number } & { class?: ClassList; style?: CSSProperties }>(
  ({ level, class: className, style, ...attributes }) => {
    return (
      <div class={["level", className]} {...scopeAttributes(attributes)} style={style}>
        <span>Level {level}</span>
        {level > 0 ? <KeepAlive level={level - 1} /> : null}
      </div>
    );
  },
);
export default KeepAlive;

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
