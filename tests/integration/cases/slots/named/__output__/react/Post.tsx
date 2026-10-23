import Card from "./Card";
import type { CSSProperties } from "react";

export interface PostAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Post({
  author,
  className,
  style,
  ...attributes
}: { author: string } & PostAttributes) {
  return (
    <Card
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
      header={<h2>Release notes</h2>}
      footer={<small>By {author}</small>}
    >
      <p>Slots arrive in M3.</p>
    </Card>
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
