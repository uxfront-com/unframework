import type { JSX } from "@solidjs/web";
import { For, Show, createMemo, untrack } from "solid-js";

export type Source =
  | { kind: "link"; id: string; title: string; href: string }
  | { kind: "book"; id: string; title: string; note?: string };

export interface ReadingProps {
  sources: Source[];
}

export interface ReadingEvents {
  onOpen?: (href: string) => void;
}

export default function Reading(
  props: ReadingProps & ReadingEvents & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ul
      class={props.class ? `reading ${props.class}` : "reading"}
      aria-label="Reading list"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <KeyedFor each={props.sources} by={(source) => source.id}>
        {(source) => (
          <li title={source.value.kind === "link" ? source.value.href : source.value.title}>
            {source.index + 1}. {source.value.title}
            {source.value.kind === "book" && source.value.note
              ? ` (${source.value.note.trim()})`
              : ""}
            <Show when={source.value.kind === "link" ? { source: source.value } : undefined}>
              {(narrowed) => (
                <button
                  type="button"
                  onClick={() => props.onOpen?.(narrowed().source.href)}
                >{`Open ${narrowed().source.title}`}</button>
              )}
            </Show>
          </li>
        )}
      </KeyedFor>
    </ul>
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
