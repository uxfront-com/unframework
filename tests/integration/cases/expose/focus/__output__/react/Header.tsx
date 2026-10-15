import SearchField from "./SearchField";
import { type CSSProperties, useRef } from "react";

export interface HeaderAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Header({ className, style }: HeaderAttributes) {
  const search = useRef<{ focus(): void }>(null);

  return (
    <header className={cx("header", className)} style={style}>
      <SearchField ref={search} label="Find" />
      <button type="button" onClick={() => search.current?.focus()}>
        Search
      </button>
    </header>
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
