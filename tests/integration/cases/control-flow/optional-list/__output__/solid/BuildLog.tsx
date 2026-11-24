import {
  type ComponentProps,
  For,
  type JSX,
  Show,
  createMemo,
  splitProps,
  untrack,
} from "solid-js";

interface LogLine {
  id: string;
  text: string;
}

export interface BuildLogProps {
  target: string;
  failed: boolean;
  lines?: LogLine[] | null;
  warnings?: string[];
}

export default function BuildLog(
  props: BuildLogProps &
    Omit<ComponentProps<"section">, "target" | "failed" | "lines" | "warnings" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["target", "failed", "lines", "warnings", "class"]);

  return (
    <section
      class={props.class ? `build-log ${props.class}` : "build-log"}
      aria-label="Build log"
      {...others}
    >
      <pre>
        $ make {props.target}
        <Show when={props.failed}>
          <strong> (failed)</strong>
        </Show>
        {"\n"}
        <KeyedFor each={props.lines ?? []} by={(line) => line.id}>
          {(line) => (
            <code>
              {line.value.text}
              {"\n"}
            </code>
          )}
        </KeyedFor>
      </pre>
      <ul aria-label="Warnings">
        <KeyedFor each={props.warnings ?? []} by={(warning) => warning}>
          {(warning) => <li>{warning.value}</li>}
        </KeyedFor>
      </ul>
    </section>
  );
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}
