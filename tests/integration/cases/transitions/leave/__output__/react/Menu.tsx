import { Transition } from "./_unframework/Transition";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";
import "./Menu.uf.tsx.css";

export type MenuAttributes = Omit<ComponentPropsWithRef<"nav">, "children">;

export default function Menu({ className, style, ...attributes }: MenuAttributes) {
  const [open, setOpen] = useState(true);
  const openRef = useRef(open);

  return (
    <nav
      className={cx("menu", className)}
      aria-label="Account"
      style={style}
      data-uf-e688a71a=""
      {...attributes}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          openRef.current = !openRef.current;
          setOpen(openRef.current);
        }}
        data-uf-e688a71a=""
      >
        Account
      </button>
      <Transition name="fade">
        {open ? (
          <ul key={0} className="items" data-uf-e688a71a="">
            <li data-uf-e688a71a="">Profile</li>
            <li data-uf-e688a71a="">Sign out</li>
          </ul>
        ) : null}
      </Transition>
    </nav>
  );
}
