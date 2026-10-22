import Legend from "./Legend";
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
