import List from "./List";
import type { ComponentPropsWithRef } from "react";

export type RankingAttributes = Omit<ComponentPropsWithRef<"div">, "names" | "children">;

export default function Ranking({
  names,
  className,
  style,
  ...attributes
}: { names: string[] } & RankingAttributes) {
  return (
    <div className={className} style={style} {...attributes}>
      <List
        items={names}
        label="Podium"
        renderItem={({ item, index }) => (
          <span>
            {index + 1}. <b>{item}</b>
          </span>
        )}
      />
      <List
        items={names}
        label="Initials"
        renderItem={(entry) => <i>{entry.item.slice(0, 1)}</i>}
      />
    </div>
  );
}
