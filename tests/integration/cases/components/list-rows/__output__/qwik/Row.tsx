import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<
  { name: string; done: boolean } & { class?: ClassList; style?: CSSProperties }
>(({ name, done, class: className, style, ...attributes }) => {
  return (
    <div
      role="listitem"
      class={["row", { done }, className]}
      {...scopeAttributes(attributes)}
      style={style}
    >
      {name}
      {done ? " (done)" : ""}
    </div>
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
