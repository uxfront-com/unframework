import { Transition } from "./_unframework/Transition";
import { type ComponentPropsWithRef, useRef, useState } from "react";
import "./Drawer.uf.tsx.css";

export type DrawerAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Drawer({ className, style, ...attributes }: DrawerAttributes) {
  const [shown, setShown] = useState(true);
  const shownRef = useRef(shown);
  const [open, setOpen] = useState(true);
  const openRef = useRef(open);

  return (
    <section
      aria-label="Filters"
      className={className}
      style={style}
      data-uf-54e3e959=""
      {...attributes}
    >
      <button
        type="button"
        onClick={() => {
          shownRef.current = !shownRef.current;
          setShown(shownRef.current);
        }}
        data-uf-54e3e959=""
      >
        Drawer
      </button>
      <button
        type="button"
        onClick={() => {
          openRef.current = !openRef.current;
          setOpen(openRef.current);
        }}
        data-uf-54e3e959=""
      >
        Body
      </button>
      {shown ? (
        <Transition name="fade">
          {open ? (
            <p key={0} className="body" data-uf-54e3e959="">
              Colour, size
            </p>
          ) : null}
        </Transition>
      ) : null}
    </section>
  );
}
