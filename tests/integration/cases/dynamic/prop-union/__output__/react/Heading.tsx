export default function Heading({
  tag,
  text,
  ...attributes
}: {
  tag: "h1" | "h2" | "h3";
  text: string;
}) {
  const Tag = tag;

  return (
    <Tag className="heading" {...scopeAttributes(attributes)}>
      {text}
    </Tag>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
