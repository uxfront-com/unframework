import { useTeardown } from "./useTeardown";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useComputed$,
} from "@qwik.dev/core";

export interface PanelEvents {
  onClosed$?: QRL<(entry: string) => void>;
}

export default component$<
  { name: string } & PanelEvents &
    Omit<PropsOf<"section">, "name" | "onClosed$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ name, onClosed$, class: className, style, ...attributes }) => {
  const { title } = useTeardown(
    useComputed$(() => name),
    $((entry) => onClosed$?.(entry)),
  );

  return (
    <section class={["panel", className]} aria-label={title.value} style={style} {...attributes}>
      <h2>{title.value}</h2>
    </section>
  );
});
