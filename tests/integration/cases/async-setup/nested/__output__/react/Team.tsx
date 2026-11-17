import Lead from "./Lead";
import Member from "./Member";
import { type CSSProperties, useRef } from "react";

export interface TeamAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Team({
  ids,
  className,
  style,
  ...attributes
}: { ids: string[] } & TeamAttributes) {
  const first = useRef<{ reset(): void }>(null);

  return (
    <section
      className={cx("team", className)}
      aria-label="Team"
      style={style}
      {...scopeAttributes(attributes)}
    >
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
      <Lead id="hopper" className="lead" />
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
