import { Transition } from "./_unframework/Transition";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";
import "./Menu.uf.tsx.css";

export type MenuAttributes = Omit<ComponentPropsWithRef<"nav">, "children">;

export default function Menu({ className, style, ...attributes }: MenuAttributes) {
  const [open, setOpen] = useState(true);
  const openRef = useRef(open);
  const [refreshes, setRefreshes] = useState(0);
  const refreshesRef = useRef(refreshes);

  function refresh() {
    refreshesRef.current++;
    setRefreshes(refreshesRef.current);
    openRef.current = false;
    setOpen(openRef.current);
    setTimeout(() => {
      openRef.current = true;
      setOpen(openRef.current);
    }, 80);
  }

  return (
    <nav
      className={cx("menu", className)}
      aria-label="Account"
      style={style}
      data-uf-e688a71a=""
      {...attributes}
    >
      <button type="button" aria-expanded={open} onClick={refresh} data-uf-e688a71a="">
        Refresh
      </button>
      <p role="status" data-uf-e688a71a="">
        Refreshes: {refreshes}
      </p>
      <Transition name="fade">
        {open ? (
          <ul key={0} className="items" data-uf-e688a71a="">
            <li data-uf-e688a71a="">Profile</li>
          </ul>
        ) : null}
      </Transition>
    </nav>
  );
}
