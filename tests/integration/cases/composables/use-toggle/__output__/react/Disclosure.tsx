import { useToggle } from "./useToggle";
import type { ComponentPropsWithRef } from "react";

export type DisclosureAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Disclosure({ className, style, ...attributes }: DisclosureAttributes) {
  const { on, toggle, close } = useToggle(false);

  return (
    <section
      className={cx("disclosure", className)}
      aria-label="Shipping"
      style={style}
      {...attributes}
    >
      <button type="button" aria-expanded={on} onClick={() => toggle()}>
        Shipping details
      </button>
      {on ? (
        <div className="panel">
          <p>Orders ship within two days.</p>
          <button type="button" onClick={() => close()}>
            Close
          </button>
        </div>
      ) : null}
    </section>
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
