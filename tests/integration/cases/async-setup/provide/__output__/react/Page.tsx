import Badge from "./Badge";
import Panel from "./Panel";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface PageAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Page({ className, style, ...attributes }: PageAttributes) {
  return (
    <main className={className} style={style} {...scopeAttributes(attributes)}>
      <Panel id="ada">
        <Badge />
      </Panel>
    </main>
  );
}
