import Card from "./Card";
import Tip from "./Tip";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { subscribeNothing } from "./_unframework/subscribeNothing";
import { teleport } from "./_unframework/teleport";
import { type CSSProperties, useRef, useState, useSyncExternalStore } from "react";

interface Row {
  id: number;
  label: string;
}

export interface BoardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Board({ className, style, ...attributes }: BoardAttributes) {
  const [rows, setRows] = useState<Row[]>([
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
    { id: 3, label: "Gamma" },
  ]);
  const rowsRef = useRef(rows);
  const [late, setLate] = useState(false);
  const lateRef = useRef(late);
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  return (
    <section
      className={cx("board", className)}
      aria-label="Board"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <button
        type="button"
        onClick={() => {
          rowsRef.current = [...rowsRef.current].reverse();
          setRows(rowsRef.current);
        }}
      >
        Reverse tips
      </button>
      <button
        type="button"
        onClick={() => {
          lateRef.current = true;
          setLate(lateRef.current);
        }}
      >
        Show late
      </button>
      {rows.map((row) => (
        <Tip key={row.id} label={row.label} />
      ))}
      {late
        ? mounted
          ? teleport(
              <p data-teleported="true" className="tip" role="note">
                Late tip
              </p>,
              "body",
            )
          : null
        : null}
      <Card>
        {mounted
          ? teleport(
              <div data-teleported="true" className="slotted">
                Slotted
              </div>,
              "body",
            )
          : null}
      </Card>
    </section>
  );
}
