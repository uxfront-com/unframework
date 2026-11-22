import Lead from "./Lead";
import Member from "./Member";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
