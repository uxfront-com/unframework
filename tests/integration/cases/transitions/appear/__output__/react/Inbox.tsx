import Toast from "./Toast";
import { type CSSProperties, useRef, useState } from "react";

export interface InboxAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Inbox({ className, style, ...attributes }: InboxAttributes) {
  const [shown, setShown] = useState(true);
  const shownRef = useRef(shown);

  return (
    <section
      aria-label="Inbox"
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <button
        type="button"
        onClick={() => {
          shownRef.current = !shownRef.current;
          setShown(shownRef.current);
        }}
      >
        {shown ? "Hide" : "Show"}
      </button>
      {shown ? <Toast /> : null}
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
