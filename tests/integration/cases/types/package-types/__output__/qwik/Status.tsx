import type { Labelled } from "./types";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";
import type { TimeInterval } from "rxjs";

type StatusProps = TimeInterval<string> & Labelled;

export default component$<
  StatusProps &
    Omit<PropsOf<"p">, "value" | "interval" | "label" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ value, interval, label, class: className, style, ...attributes }) => {
  return (
    <p class={className} style={style} {...attributes}>
      {label}: {value} after {interval} ms
    </p>
  );
});
