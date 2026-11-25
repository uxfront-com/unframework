import Member from "./Member";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, Fragment, useRef, useState } from "react";

export type RosterAttributes = Omit<ComponentPropsWithRef<"section">, "ids" | "children">;

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
    <section className={cx("roster", className)} aria-label="Roster" style={style} {...attributes}>
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
