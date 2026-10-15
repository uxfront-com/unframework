import Notice from "./Notice";
import type { CSSProperties } from "react";

export interface BoardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Board({ build, className, style }: { build: string } & BoardAttributes) {
  return (
    <div className={className} style={style}>
      <Notice label="Build" action={<a href="#logs">See the logs</a>}>
        Build {build} failed.
      </Notice>
      <Notice label="Deploy" />
    </div>
  );
}
