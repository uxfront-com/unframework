import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";
import "virtual:styleframe.css";

export default component$<
  { text: string; dark?: boolean } & { class?: ClassList; style?: CSSProperties }
>(({ text, dark = false, class: className, style, ...attributes }) => {
  return (
    <section
      data-theme={dark ? "dark" : "light"}
      class={["_padding:md _background-color:surface _color:text", className]}
      {...scopeAttributes(attributes)}
      style={style}
    >
      {text}
    </section>
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
