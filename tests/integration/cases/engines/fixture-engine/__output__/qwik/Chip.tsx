import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";
import { chip } from "virtual:fixture-engine";
import "virtual:fixture-engine.css";

export default component$<
  { label: string; tone?: "plain" | "accent" } & { class?: ClassList; style?: CSSProperties }
>(({ label, tone, class: className, style, ...attributes }) => {
  return (
    <span class={[chip(tone), className]} {...scopeAttributes(attributes)} style={style}>
      {label}
    </span>
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
