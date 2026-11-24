import type { Labelled } from "./types";
import type { TimeInterval } from "rxjs";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

type StatusProps = TimeInterval<string> & Labelled;

export default function Status(
  props: StatusProps &
    Omit<ComponentProps<"p">, "value" | "interval" | "label" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["value", "interval", "label"]);

  return (
    <p {...others}>
      {props.label}: {props.value} after {props.interval} ms
    </p>
  );
}
