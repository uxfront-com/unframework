import Chart from "./Chart";
import { $, type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const open = useSignal(false);

    const show = $(() => {
      open.value = true;
    });

    return (
      <section aria-label="Report" {...scopeAttributes(attributes)} class={className} style={style}>
        <button type="button" onClick$={show}>
          Show the chart
        </button>
        {open.value ? <Chart /> : null}
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
