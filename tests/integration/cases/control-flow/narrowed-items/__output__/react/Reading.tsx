import type { CSSProperties } from "react";

export type Source =
  | { kind: "link"; id: string; title: string; href: string }
  | { kind: "book"; id: string; title: string; note?: string };

export interface ReadingProps {
  sources: Source[];
}

export interface ReadingEvents {
  onOpen?: (href: string) => void;
}

export interface ReadingAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Reading({
  sources,
  onOpen,
  className,
  style,
  ...attributes
}: ReadingProps & ReadingEvents & ReadingAttributes) {
  return (
    <ul
      className={cx("reading", className)}
      aria-label="Reading list"
      style={style}
      {...scopeAttributes(attributes)}
    >
      {sources.map((source, index) => (
        <li key={source.id} title={source.kind === "link" ? source.href : source.title}>
          {index + 1}. {source.title}
          {source.kind === "book" && source.note ? ` (${source.note.trim()})` : ""}
          {source.kind === "link" ? (
            <button
              type="button"
              onClick={() => onOpen?.(source.href)}
            >{`Open ${source.title}`}</button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
