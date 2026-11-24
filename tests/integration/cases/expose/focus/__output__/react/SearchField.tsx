import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
