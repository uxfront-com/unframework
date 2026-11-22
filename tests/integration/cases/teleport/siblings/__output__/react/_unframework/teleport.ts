import type { ReactNode, ReactPortal } from "react";
import { createPortal } from "react-dom";

/** Portals `children` into the element `to` selects, or renders nothing where none does. */
export function teleport(children: ReactNode, to: string): ReactPortal | null {
  const target = document.querySelector(to);
  return target ? createPortal(children, target) : null;
}
