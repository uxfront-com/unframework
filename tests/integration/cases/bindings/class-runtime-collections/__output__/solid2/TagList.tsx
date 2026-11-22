import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

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

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
