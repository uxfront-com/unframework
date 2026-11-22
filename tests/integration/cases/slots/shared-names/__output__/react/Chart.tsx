import Legend from "./Legend";
import type { ComponentPropsWithRef } from "react";

export type ChartAttributes = Omit<ComponentPropsWithRef<"div">, "series" | "children">;

export default function Chart({
  series,
  className,
  style,
  ...attributes
}: { series: string[] } & ChartAttributes) {
  return (
    <div className={className} style={style} {...attributes}>
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
