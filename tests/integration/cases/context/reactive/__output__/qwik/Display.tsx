import { CountKey } from "./Counter";
import {
  type CSSProperties,
  type ClassList,
  component$,
  useContext,
  useSignal,
} from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const none = useSignal(0);
    const count = useContext(CountKey, (provided?) => (provided === undefined ? none : provided));

    return (
      <output {...scopeAttributes(attributes)} class={className} style={style}>
        Count: {count.value}
      </output>
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
