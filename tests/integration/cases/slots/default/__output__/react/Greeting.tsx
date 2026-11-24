import Panel from "./Panel";
import type { ComponentPropsWithRef } from "react";

export type GreetingAttributes = Omit<
  ComponentPropsWithRef<typeof Panel>,
  "name" | "children" | "title"
>;

export default function Greeting({
  name,
  className,
  style,
  ...attributes
}: { name: string } & GreetingAttributes) {
  return (
    <Panel title="Welcome" className={className} style={style} {...attributes}>
      <p>
        Hello, <strong>{name}</strong>!
      </p>
      <p>Your children render in the panel.</p>
    </Panel>
  );
}
