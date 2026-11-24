import Toast from "./Toast";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type InboxAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Inbox({ className, style, ...attributes }: InboxAttributes) {
  const [shown, setShown] = useState(true);
  const shownRef = useRef(shown);

  return (
    <section aria-label="Inbox" className={className} style={style} {...attributes}>
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
