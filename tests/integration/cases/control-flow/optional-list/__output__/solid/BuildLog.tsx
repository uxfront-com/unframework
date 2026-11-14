import { type Accessor, For, type JSX, Show, createMemo, untrack } from "solid-js";

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
  props: BuildLogProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `build-log ${props.class}` : "build-log"}
      aria-label="Build log"
      style={props.style}
      {...scopeAttributes(props)}
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
              {line().text}
              {"\n"}
            </code>
          )}
        </KeyedFor>
      </pre>
      <ul aria-label="Warnings">
        <KeyedFor each={props.warnings ?? []} by={(warning) => warning}>
          {(warning) => <li>{warning()}</li>}
        </KeyedFor>
      </ul>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element;
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
        return untrack(() => props.children(item, index));
      }}
    </For>
  );
}
