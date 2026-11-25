import Picker from "./Picker";
import { cx } from "./_unframework/cx";
import { useElementDirective } from "./_unframework/useElementDirective";
import { vTrace } from "./vTrace";
import type { ComponentPropsWithRef } from "react";

export type PageAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Page({ className, style, ...attributes }: PageAttributes) {
  const withTrace = useElementDirective(vTrace);

  return (
    <section className={cx("page", className)} aria-label="Page" style={style} {...attributes}>
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
