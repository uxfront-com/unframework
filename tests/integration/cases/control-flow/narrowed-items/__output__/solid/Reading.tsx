import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, Show, splitProps } from "solid-js";

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
  props: ReadingProps &
    ReadingEvents &
    Omit<ComponentProps<"ul">, "sources" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["sources", "onOpen", "class"]);

  return (
    <ul
      class={props.class ? `reading ${props.class}` : "reading"}
      aria-label="Reading list"
      {...others}
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
