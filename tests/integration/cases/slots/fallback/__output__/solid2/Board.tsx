import Notice from "./Notice";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Board(
  props: { build: string } & Omit<ComponentProps<"div">, "build" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "build");

  return (
    <div {...others}>
      <Notice label="Build" action={<a href="#logs">See the logs</a>}>
        Build {props.build} failed.
      </Notice>
      <Notice label="Deploy" />
    </div>
  );
}
