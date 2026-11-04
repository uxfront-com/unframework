import { useClock } from "./useClock";
import {
  type CSSProperties,
  type ClassList,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const ready = useSignal(false);

    useVisibleTask$(
      () => {
        ready.value = true;
      },
      { strategy: "document-ready" },
    );

    const { started } = useClock();

    return (
      <p class={["clock", className]} {...scopeAttributes(attributes)} style={style}>
        {ready.value ? "Ready" : "Waiting"}, {started.value ? "started" : "stopped"}
      </p>
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
