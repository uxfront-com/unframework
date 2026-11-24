import Chart from "./Chart";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type ReportPanelAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function ReportPanel({ className, style, ...attributes }: ReportPanelAttributes) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);

  function show() {
    openRef.current = true;
    setOpen(openRef.current);
  }

  return (
    <section aria-label="Report" className={className} style={style} {...attributes}>
      <button type="button" onClick={show}>
        Show the chart
      </button>
      {open ? <Chart /> : null}
    </section>
  );
}
