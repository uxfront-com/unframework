import { type CSSProperties, type ClassList, type QRL, component$ } from "@qwik.dev/core";

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
  ReadingProps & ReadingEvents & { class?: ClassList; style?: CSSProperties }
>(({ sources, onOpen$, class: className, style, ...attributes }) => {
  return (
    <ul
      class={["reading", className]}
      aria-label="Reading list"
      {...scopeAttributes(attributes)}
      style={style}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
