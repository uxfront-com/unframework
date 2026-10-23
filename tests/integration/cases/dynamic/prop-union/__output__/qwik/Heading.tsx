import { component$ } from "@qwik.dev/core";

export default component$<{ tag: "h1" | "h2" | "h3"; text: string }>(
  ({ tag, text, ...attributes }) => {
    const Tag = tag;

    return (
      <>
        <Tag class="heading" {...scopeAttributes(attributes)}>
          {text}
        </Tag>
      </>
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
