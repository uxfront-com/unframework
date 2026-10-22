import KeepAlive from "./KeepAlive";
import Transition from "./Transition";
import TransitionComponent from "./TransitionComponent";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    return (
      <section aria-label="Wizard" {...scopeAttributes(attributes)} class={className} style={style}>
        <Transition step="details" />
        <TransitionComponent />
        <KeepAlive level={2} />
      </section>
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
