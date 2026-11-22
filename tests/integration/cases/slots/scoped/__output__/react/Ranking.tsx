import List from "./List";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface RankingAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Ranking({
  names,
  className,
  style,
  ...attributes
}: { names: string[] } & RankingAttributes) {
  return (
    <div className={className} style={style} {...scopeAttributes(attributes)}>
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
