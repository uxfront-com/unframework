import Chart from "./Chart";
import { type JSX, Show, createSignal } from "solid-js";

export default function ReportPanel(props: { class?: string; style?: JSX.CSSProperties }) {
  const [open, setOpen] = createSignal(false);

  function show() {
    setOpen(true);
  }

  return (
    <section
      aria-label="Report"
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <button type="button" onClick={show}>
        Show the chart
      </button>
      <Show when={open()}>
        <Chart />
      </Show>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
