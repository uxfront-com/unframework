import { type CSSProperties, useState } from "react";

export interface SearchFieldModels {
  query?: string;
  onQueryChange?: (value: string | undefined) => void;
}

export interface SearchFieldAttributes {
  className?: string;
  style?: CSSProperties;
}

export function SearchField({
  query: queryProp,
  onQueryChange,
  className,
  style,
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
      }}
      className={className}
      style={style}
    />
  );
}
