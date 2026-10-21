import Panel from "./Panel";
import type { CSSProperties } from "react";

export interface GreetingAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Greeting({
  name,
  className,
  style,
  ...attributes
}: { name: string } & GreetingAttributes) {
  return (
    <Panel title="Welcome" className={className} style={style} {...scopeAttributes(attributes)}>
      <p>
        Hello, <strong>{name}</strong>!
      </p>
      <p>Your children render in the panel.</p>
    </Panel>
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
