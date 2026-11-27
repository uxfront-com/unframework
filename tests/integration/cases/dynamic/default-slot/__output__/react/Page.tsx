import Action from "./Action";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type PageAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Page({ className, style, ...attributes }: PageAttributes) {
  const [linked, setLinked] = useState(true);
  const linkedRef = useRef(linked);

  return (
    <section className={cx("page", className)} style={style} {...attributes}>
      <Action href="#docs" label="Docs">
        Read the docs
      </Action>
      <Action label="Save">Save the draft</Action>
      <Action href="#home" label="Home" />
      <Action label="Close" />
      <Action href={linked ? "#more" : undefined} label="More" icon={<i aria-hidden="true">+</i>}>
        Learn more
      </Action>
      <button
        type="button"
        onClick={() => {
          linkedRef.current = !linkedRef.current;
          setLinked(linkedRef.current);
        }}
      >
        Toggle
      </button>
    </section>
  );
}
