import Card from "./Card";
import Tip from "./Tip";
import {
  type CSSProperties,
  type ReactNode,
  type ReactPortal,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

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
  ]);
  const rowsRef = useRef(rows);
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
      {rows.map((row) => (
        <Tip key={row.id} label={row.label} />
      ))}
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

/** Subscribes to nothing: whether the component has mounted never changes once it has. */
function subscribeNothing(): () => void {
  return () => {};
}

/** Portals `children` into the element `to` selects, or renders nothing where none does. */
function teleport(children: ReactNode, to: string): ReactPortal | null {
  const target = document.querySelector(to);
  return target ? createPortal(children, target) : null;
}
