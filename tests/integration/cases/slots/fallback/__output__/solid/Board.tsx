import Notice from "./Notice";
import type { JSX } from "solid-js";

export default function Board(
  props: { build: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Notice label="Build" action={<a href="#logs">See the logs</a>}>
        Build {props.build} failed.
      </Notice>
      <Notice label="Deploy" />
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
