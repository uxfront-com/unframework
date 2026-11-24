import { useTeardown } from "./useTeardown";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface PanelEvents {
  onClosed?: (entry: string) => void;
}

export default function Panel(
  props: { name: string } & PanelEvents &
    Omit<ComponentProps<"section">, "name" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["name", "onClosed", "class"]);

  const { title } = useTeardown(
    () => props.name,
    (entry) => props.onClosed?.(entry),
  );

  return (
    <section
      class={props.class ? `panel ${props.class}` : "panel"}
      aria-label={title()}
      {...others}
    >
      <h2>{title()}</h2>
    </section>
  );
}
