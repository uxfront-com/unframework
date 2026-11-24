import Chart from "./Chart";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show } from "solid-js";

export default function ReportPanel(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [open, setOpen] = createState(false);

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
