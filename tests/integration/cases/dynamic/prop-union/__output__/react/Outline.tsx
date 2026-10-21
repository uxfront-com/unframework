import Heading from "./Heading";
import type { CSSProperties } from "react";

export interface OutlineAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Outline({ className, style, ...attributes }: OutlineAttributes) {
  return (
    <main className={className} style={style} {...scopeAttributes(attributes)}>
      <Heading tag="h1" text="Guide" />
      <Heading tag="h2" text="Setup" />
      <Heading tag="h3" text="Requirements" />
    </main>
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
