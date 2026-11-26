import Card from "./Card";
import Chip from "./Chip";
import { createState } from "./_unframework/createState";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Tag(
  props: { label: string } & Omit<ComponentProps<"section">, "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label");

  const [compact, setCompact] = createState(true);

  return (
    <section aria-label="Tag" {...others}>
      <Dynamic component={compact() ? Chip : Card} label={props.label} />
      <button type="button" onClick={() => setCompact(!compact())}>
        {compact() ? "Expand" : "Compact"}
      </button>
    </section>
  );
}
