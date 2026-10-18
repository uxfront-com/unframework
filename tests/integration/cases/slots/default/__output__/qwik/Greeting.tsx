import Panel from "./Panel";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ name: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ name, class: className, style }) => {
    return (
      <>
        <Panel title="Welcome" class={className} style={style}>
          <p>
            Hello, <strong>{name}</strong>!
          </p>
          <p>Your children render in the panel.</p>
        </Panel>
      </>
    );
  },
);
