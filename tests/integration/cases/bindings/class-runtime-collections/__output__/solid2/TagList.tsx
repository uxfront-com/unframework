import { createState } from "./_unframework/createState";
import { cx } from "./_unframework/cx";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

type TagStates = { selected?: boolean; muted?: boolean };

export interface TagListProps {
  label: string;
  tags: string[];
  states: TagStates;
  extra?: string[];
}

export default function TagList(
  props: TagListProps &
    Omit<ComponentProps<"div">, "label" | "tags" | "states" | "extra" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "tags", "states", "extra", "class");

  const [expanded, setExpanded] = createState(false);

  function expand() {
    setExpanded(!expanded());
  }

  return (
    <div class={props.class ? `tag-list ${props.class}` : "tag-list"} {...others}>
      <span class={cx("tag", props.tags, props.states, { "tag-open": expanded() })}>
        {props.label}
      </span>
      <span class={cx(props.tags)}>Plain</span>
      <span class={cx(props.extra, expanded() ? ["tag-wide", "tag-tall"] : [])}>Extra</span>
      <button type="button" onClick={expand}>
        Expand
      </button>
    </div>
  );
}
