import Chart from "./Chart";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useRef, useState } from "react";

export interface ReportPanelAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ReportPanel({ className, style, ...attributes }: ReportPanelAttributes) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);

  function show() {
    openRef.current = true;
    setOpen(openRef.current);
  }

  return (
    <section
      aria-label="Report"
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <button type="button" onClick={show}>
        Show the chart
      </button>
      {open ? <Chart /> : null}
    </section>
  );
}
