import Legend from "./Legend";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Chart(
  props: { series: string[] } & Omit<ComponentProps<"div">, "series" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "series");

  return (
    <div {...others}>
      <Legend
        items={props.series}
        label="Series"
        swatch={({ item }) => <b>{item.slice(0, 1)}</b>}
        caption={({ item }) => <i>{item}</i>}
      />
      <Legend
        items={props.series}
        label="Captions"
        caption={({ item }) => <span>{item.toUpperCase()}</span>}
      />
    </div>
  );
}
