import type { Labelled } from "./types";
import type { ComponentPropsWithRef } from "react";
import type { TimeInterval } from "rxjs";

type StatusProps = TimeInterval<string> & Labelled;

export type StatusAttributes = Omit<
  ComponentPropsWithRef<"p">,
  "value" | "interval" | "label" | "children"
>;

export default function Status({
  value,
  interval,
  label,
  className,
  style,
  ...attributes
}: StatusProps & StatusAttributes) {
  return (
    <p className={className} style={style} {...attributes}>
      {label}: {value} after {interval} ms
    </p>
  );
}
