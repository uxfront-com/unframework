import { type ComponentPropsWithRef, useState } from "react";

export interface SearchFieldModels {
  query?: string;
  onQueryChange?: (value: string | undefined) => void;
}

export type SearchFieldAttributes = Omit<
  ComponentPropsWithRef<"input">,
  "query" | "onQueryChange" | "children"
>;

export function SearchField({
  query: queryProp,
  onQueryChange,
  className,
  style,
  value: _value,
  onChange,
  ...attributes
}: SearchFieldModels & SearchFieldAttributes) {
  const [localQuery, setLocalQuery] = useState<{ value: string | undefined }>({ value: undefined });
  const query = queryProp === undefined ? localQuery.value : queryProp;

  return (
    <input
      type="search"
      aria-label="Search"
      value={query ?? ""}
      onChange={(event) => {
        setLocalQuery({ value: event.target.value });
        onQueryChange?.(event.target.value);
        onChange?.(event);
      }}
      className={className}
      style={style}
      {...attributes}
    />
  );
}
