import Panel from "./Panel";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
