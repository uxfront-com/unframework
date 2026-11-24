import Notice from "./Notice";
import type { ComponentPropsWithRef } from "react";

export type BoardAttributes = Omit<ComponentPropsWithRef<"div">, "build" | "children">;

export default function Board({
  build,
  className,
  style,
  ...attributes
}: { build: string } & BoardAttributes) {
  return (
    <div className={className} style={style} {...attributes}>
      <Notice label="Build" action={<a href="#logs">See the logs</a>}>
        Build {build} failed.
      </Notice>
      <Notice label="Deploy" />
    </div>
  );
}
