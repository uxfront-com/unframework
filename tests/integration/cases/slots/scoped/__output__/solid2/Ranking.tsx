import List from "./List";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Ranking(
  props: { names: string[] } & Omit<ComponentProps<"div">, "names" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "names");

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
