import Section from "./Section";
import type { CSSProperties } from "react";

export interface PageAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Page({
  name,
  className,
  style,
  ...attributes
}: { name: string } & PageAttributes) {
  return (
    <article
      aria-label="Profile"
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Section title={`About ${name}`} body="Three components deep." />
      <Section title="Contact" body={`Write to ${name}.`} />
    </article>
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
