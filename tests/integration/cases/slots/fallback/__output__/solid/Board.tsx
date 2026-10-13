import Notice from "./Notice";
import type { JSX } from "solid-js";

export default function Board(
  props: { build: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div class={props.class} style={props.style}>
      <Notice label="Build" action={<a href="#logs">See the logs</a>}>
        Build {props.build} failed.
      </Notice>
      <Notice label="Deploy" />
    </div>
  );
}
