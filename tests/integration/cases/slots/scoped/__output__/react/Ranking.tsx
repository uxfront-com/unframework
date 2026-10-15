import List from "./List";
import type { CSSProperties } from "react";

export interface RankingAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Ranking({
  names,
  className,
  style,
}: { names: string[] } & RankingAttributes) {
  return (
    <div className={className} style={style}>
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
