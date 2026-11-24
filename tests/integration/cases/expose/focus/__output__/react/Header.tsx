import SearchField from "./SearchField";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef } from "react";

export type HeaderAttributes = Omit<ComponentPropsWithRef<"header">, "children">;

export default function Header({ className, style, ...attributes }: HeaderAttributes) {
  const search = useRef<{ focus(): void }>(null);

  return (
    <header className={cx("header", className)} style={style} {...attributes}>
      <SearchField ref={search} label="Find" />
      <button type="button" onClick={() => search.current?.focus()}>
        Search
      </button>
    </header>
  );
}
