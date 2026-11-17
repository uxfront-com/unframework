import Member from "./Member";
import { type CSSProperties, Fragment, useRef, useState } from "react";

export interface RosterAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Roster({
  ids,
  className,
  style,
  ...attributes
}: { ids: string[] } & RosterAttributes) {
  const [lead, setLead] = useState(true);
  const leadRef = useRef(lead);
  const [guest, setGuest] = useState(false);
  const guestRef = useRef(guest);

  return (
    <section
      className={cx("roster", className)}
      aria-label="Roster"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <button
        type="button"
        onClick={() => {
          leadRef.current = !leadRef.current;
          setLead(leadRef.current);
        }}
      >
        Switch lead
      </button>
      <button
        type="button"
        onClick={() => {
          guestRef.current = !guestRef.current;
          setGuest(guestRef.current);
        }}
      >
        Toggle guest
      </button>
      <ul>
        {ids.map((id) => (
          <Member key={id} id={id} />
        ))}
        {lead ? (
          <Fragment key={0}>
            <Member id="ada" />
          </Fragment>
        ) : (
          <Fragment key={1}>
            <Member id="linus" />
          </Fragment>
        )}
        {guest ? <Member id="hopper" /> : null}
      </ul>
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
