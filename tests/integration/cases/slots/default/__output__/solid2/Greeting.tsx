import Panel from "./Panel";
import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";

export default function Greeting(
  props: { name: string } & Omit<ComponentProps<typeof Panel>, "name" | "children" | "title">,
) {
  const others = omit(props, "name");

  return (
    <Panel title="Welcome" {...others}>
      <p>
        Hello, <strong>{props.name}</strong>!
      </p>
      <p>Your children render in the panel.</p>
    </Panel>
  );
}
