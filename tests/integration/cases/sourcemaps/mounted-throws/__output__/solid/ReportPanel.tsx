import Chart from "./Chart";
import { type ComponentProps, type JSX, Show, createSignal } from "solid-js";

export default function ReportPanel(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [open, setOpen] = createSignal(false);

  function show() {
    setOpen(true);
  }

  return (
    <section aria-label="Report" {...props}>
      <button type="button" onClick={show}>
        Show the chart
      </button>
      <Show when={open()}>
        <Chart />
      </Show>
    </section>
  );
}
