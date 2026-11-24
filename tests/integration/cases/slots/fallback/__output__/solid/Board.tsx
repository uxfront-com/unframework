import Notice from "./Notice";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Board(
  props: { build: string } & Omit<ComponentProps<"div">, "build" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["build"]);

  return (
    <div {...others}>
      <Notice label="Build" action={<a href="#logs">See the logs</a>}>
        Build {props.build} failed.
      </Notice>
      <Notice label="Deploy" />
    </div>
  );
}
