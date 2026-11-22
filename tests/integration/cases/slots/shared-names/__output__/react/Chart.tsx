import Legend from "./Legend";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface ChartAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Chart({
  series,
  className,
  style,
  ...attributes
}: { series: string[] } & ChartAttributes) {
  return (
    <div className={className} style={style} {...scopeAttributes(attributes)}>
      <Legend
        items={series}
        label="Series"
        renderSwatch={({ item }) => <b>{item.slice(0, 1)}</b>}
        renderCaption={({ item }) => <i>{item}</i>}
      />
      <Legend
        items={series}
        label="Captions"
        renderCaption={({ item }) => <span>{item.toUpperCase()}</span>}
      />
    </div>
  );
}
