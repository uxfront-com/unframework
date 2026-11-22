import { useTeardown } from "./useTeardown";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface PanelEvents {
  onClosed?: (entry: string) => void;
}

export default function Panel(
  props: { name: string } & PanelEvents &
    Omit<ComponentProps<"section">, "name" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "name", "onClosed", "class");

  const { title } = useTeardown(
    () => props.name,
    (entry) => props.onClosed?.(entry),
  );

  return (
    <section
      class={props.class ? `panel ${props.class}` : "panel"}
      aria-label={enumeratedValue(title())}
      {...others}
    >
      <h2>{title()}</h2>
    </section>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}
