import Notice from "./Notice";
import type { CSSProperties } from "react";

export interface BoardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Board({
  build,
  className,
  style,
  ...attributes
}: { build: string } & BoardAttributes) {
  return (
    <div className={className} style={style} {...scopeAttributes(attributes)}>
      <Notice label="Build" action={<a href="#logs">See the logs</a>}>
        Build {build} failed.
      </Notice>
      <Notice label="Deploy" />
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
