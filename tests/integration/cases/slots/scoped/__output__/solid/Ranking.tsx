import List from "./List";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Ranking(
  props: { names: string[] } & Omit<ComponentProps<"div">, "names" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["names"]);

  return (
    <div {...others}>
      <List
        items={props.names}
        label="Podium"
        item={({ item, index }) => (
          <span>
            {index + 1}. <b>{item}</b>
          </span>
        )}
      />
      <List
        items={props.names}
        label="Initials"
        item={(entry) => <i>{entry.item.slice(0, 1)}</i>}
      />
    </div>
  );
}
