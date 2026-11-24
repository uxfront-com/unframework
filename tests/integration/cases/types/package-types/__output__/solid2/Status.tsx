import type { Labelled } from "./types";
import type { ComponentProps, JSX } from "@solidjs/web";
import type { TimeInterval } from "rxjs";
import { omit } from "solid-js";

type StatusProps = TimeInterval<string> & Labelled;

export default function Status(
  props: StatusProps &
    Omit<ComponentProps<"p">, "value" | "interval" | "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "value", "interval", "label");

  return (
    <p {...others}>
      {props.label}: {props.value} after {props.interval} ms
    </p>
  );
}
