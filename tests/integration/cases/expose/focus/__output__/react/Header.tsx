import SearchField from "./SearchField";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useRef } from "react";

export interface HeaderAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Header({ className, style, ...attributes }: HeaderAttributes) {
  const search = useRef<{ focus(): void }>(null);

  return (
    <header className={cx("header", className)} style={style} {...scopeAttributes(attributes)}>
      <SearchField ref={search} label="Find" />
      <button type="button" onClick={() => search.current?.focus()}>
        Search
      </button>
    </header>
  );
}
