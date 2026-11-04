import { useTeardown } from "./useTeardown";
import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useComputed$,
} from "@qwik.dev/core";

export interface PanelEvents {
  onClosed$?: QRL<(entry: string) => void>;
}

export default component$<
  { name: string } & PanelEvents & { class?: ClassList; style?: CSSProperties }
>(({ name, onClosed$, class: className, style, ...attributes }) => {
  const { title } = useTeardown(
    useComputed$(() => name),
    $((entry) => onClosed$?.(entry)),
  );

  return (
    <section
      class={["panel", className]}
      aria-label={title.value}
      {...scopeAttributes(attributes)}
      style={style}
    >
      <h2>{title.value}</h2>
    </section>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
