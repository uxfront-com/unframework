import Lead from "./Lead";
import Member from "./Member";
import { cx } from "./_unframework/cx";
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
