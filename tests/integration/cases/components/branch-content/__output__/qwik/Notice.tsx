import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<
  { text: string; tone: "info" | "quiet" } & { class?: ClassList; style?: CSSProperties }
>(({ text, tone, class: className, style, ...attributes }) => {
  return (
    <p
      role="status"
      class={["notice", tone, className]}
      {...scopeAttributes(attributes)}
      style={style}
    >
      {text}
    </p>
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
