import Picker from "./Picker";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useElementDirective } from "./_unframework/useElementDirective";
import { vTrace } from "./vTrace";
import type { CSSProperties } from "react";

export interface PageAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Page({ className, style, ...attributes }: PageAttributes) {
  const withTrace = useElementDirective(vTrace);

  return (
    <section
      className={cx("page", className)}
      aria-label="Page"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Picker
        renderOption={({ option }) => (
          <span data-name={`option-${option.id}`} ref={withTrace(option.label)}>
            {option.label}
          </span>
        )}
      />
    </section>
  );
}
