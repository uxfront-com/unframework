import Badge from "./Badge";
import Panel from "./Panel";
import type { CSSProperties } from "react";

export interface PageAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Page({ className, style, ...attributes }: PageAttributes) {
  return (
    <main className={className} style={style} {...scopeAttributes(attributes)}>
      <Panel id="ada">
        <Badge />
      </Panel>
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
