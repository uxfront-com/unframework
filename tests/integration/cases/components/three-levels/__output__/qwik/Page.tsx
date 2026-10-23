import Section from "./Section";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ name: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ name, class: className, style, ...attributes }) => {
    return (
      <article
        aria-label="Profile"
        {...scopeAttributes(attributes)}
        class={className}
        style={style}
      >
        <Section title={`About ${name}`} body="Three components deep." />
        <Section title="Contact" body={`Write to ${name}.`} />
      </article>
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
