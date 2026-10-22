import Panel from "./Panel";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ name: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ name, class: className, style, ...attributes }) => {
    return (
      <>
        <Panel title="Welcome" {...scopeAttributes(attributes)} class={className} style={style}>
          <p>
            Hello, <strong>{name}</strong>!
          </p>
          <p>Your children render in the panel.</p>
        </Panel>
      </>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
