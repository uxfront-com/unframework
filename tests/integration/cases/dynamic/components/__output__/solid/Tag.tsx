import Card from "./Card";
import Chip from "./Chip";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export default function Tag(
  props: { label: string } & Omit<ComponentProps<"section">, "label" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label"]);

  const [compact, setCompact] = createSignal(true);

  return (
    <section aria-label="Tag" {...others}>
      <Dynamic component={compact() ? Chip : Card} label={props.label} />
      <button type="button" onClick={() => setCompact(!compact())}>
        {compact() ? "Expand" : "Compact"}
      </button>
    </section>
  );
}
