import Chart from "./Chart";
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
