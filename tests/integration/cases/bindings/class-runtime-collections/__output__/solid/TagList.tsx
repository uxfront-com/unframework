import { type JSX, createSignal } from "solid-js";

type TagStates = { selected?: boolean; muted?: boolean };

export interface TagListProps {
  label: string;
  tags: string[];
  states: TagStates;
  extra?: string[];
}

export default function TagList(
  props: TagListProps & { class?: string; style?: JSX.CSSProperties },
) {
  const [expanded, setExpanded] = createSignal(false);

  function expand() {
    setExpanded(!expanded());
  }

  return (
    <div
      class={props.class ? `tag-list ${props.class}` : "tag-list"}
      style={props.style}
      {...scopeAttributes(props)}
    >
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
    else if (Array.isArray(part)) names.push(cx(...part));
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
