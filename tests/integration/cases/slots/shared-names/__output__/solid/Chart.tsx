import Legend from "./Legend";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Chart(
  props: { series: string[] } & Omit<ComponentProps<"div">, "series" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["series"]);

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
