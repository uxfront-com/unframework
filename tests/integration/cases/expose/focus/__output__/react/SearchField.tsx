import { type CSSProperties, type Ref, useImperativeHandle, useRef } from "react";

export interface SearchFieldHandle {
  focus(): void;
}

export interface SearchFieldAttributes {
  className?: string;
  style?: CSSProperties;
  ref?: Ref<SearchFieldHandle>;
}

export default function SearchField({
  label,
  className,
  style,
  ref,
  ...attributes
}: { label: string } & SearchFieldAttributes) {
  const input = useRef<HTMLInputElement>(null);

  function focus() {
    input.current?.focus();
  }

  useImperativeHandle(ref, () => ({ focus }));

  return (
    <label className={cx("search", className)} style={style} {...scopeAttributes(attributes)}>
      {label}
      <input ref={input} type="search" />
    </label>
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
