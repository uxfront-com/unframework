import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export type Source =
  | { kind: "link"; id: string; title: string; href: string }
  | { kind: "book"; id: string; title: string; note?: string };

export interface ReadingProps {
  sources: Source[];
}

export interface ReadingEvents {
  onOpen$?: QRL<(href: string) => void>;
}

export default component$<
  ReadingProps &
    ReadingEvents &
    Omit<PropsOf<"ul">, "sources" | "onOpen$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ sources, onOpen$, class: className, style, ...attributes }) => {
  return (
    <ul class={["reading", className]} aria-label="Reading list" style={style} {...attributes}>
      {sources.map((source, index) => (
        <li key={source.id} title={source.kind === "link" ? source.href : source.title}>
          {index + 1}. {source.title}
          {source.kind === "book" && source.note ? ` (${source.note.trim()})` : ""}
          {source.kind === "link" ? (
            <button
              type="button"
              onClick$={() => onOpen$?.(source.href)}
            >{`Open ${source.title}`}</button>
          ) : null}
        </li>
      ))}
    </ul>
  );
});
