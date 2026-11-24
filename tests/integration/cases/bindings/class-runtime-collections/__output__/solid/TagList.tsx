import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

type TagStates = { selected?: boolean; muted?: boolean };

export interface TagListProps {
  label: string;
  tags: string[];
  states: TagStates;
  extra?: string[];
}

export default function TagList(
  props: TagListProps &
    Omit<ComponentProps<"div">, "label" | "tags" | "states" | "extra" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "tags", "states", "extra", "class"]);

  const [expanded, setExpanded] = createSignal(false);

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

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (Array.isArray(part)) {
      const joined = cx(...part);
      if (joined) names.push(joined);
    } else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}
