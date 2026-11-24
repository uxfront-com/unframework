import Badge from "./Badge";
import Panel from "./Panel";
import type { ComponentPropsWithRef } from "react";

export type PageAttributes = Omit<ComponentPropsWithRef<"main">, "children">;

export default function Page({ className, style, ...attributes }: PageAttributes) {
  return (
    <main className={className} style={style} {...attributes}>
      <Panel id="ada">
        <Badge />
      </Panel>
    </main>
  );
}
