import { cx } from "./_unframework/cx";
import { type ComponentPropsWithoutRef, type Ref, useImperativeHandle, useRef } from "react";

export interface SearchFieldHandle {
  focus(): void;
}

export type SearchFieldAttributes = Omit<
  ComponentPropsWithoutRef<"label">,
  "label" | "children"
> & { ref?: Ref<SearchFieldHandle> };

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
    <label className={cx("search", className)} style={style} {...attributes}>
      {label}
      <input ref={input} type="search" />
    </label>
  );
}
