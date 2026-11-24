import Lead from "./Lead";
import Member from "./Member";
import { type ComponentPropsWithRef, useRef } from "react";

export type TeamAttributes = Omit<ComponentPropsWithRef<"section">, "ids" | "children">;

export default function Team({
  ids,
  className,
  style,
  ...attributes
}: { ids: string[] } & TeamAttributes) {
  const first = useRef<{ reset(): void }>(null);

  return (
    <section className={cx("team", className)} aria-label="Team" style={style} {...attributes}>
      <h2>Team</h2>
      <button type="button" onClick={() => first.current?.reset()}>
        Reset
      </button>
      <Member ref={first} id="ada" />
      <ul>
        {ids.map((id) => (
          <li key={id}>
            <Member id={id} />
          </li>
        ))}
      </ul>
      <Lead className="lead" id="hopper" />
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
