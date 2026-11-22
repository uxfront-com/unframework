import Toast from "./Toast";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
