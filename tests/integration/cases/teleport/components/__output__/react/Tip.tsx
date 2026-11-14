import { type ReactNode, type ReactPortal, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export interface TipProps {
  label: string;
}

export default function Tip({ label }: TipProps) {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  return (
    <>
      {mounted
        ? teleport(
            <p data-teleported="true" className="tip" role="note">
              {label} tip
            </p>,
            "body",
          )
        : null}
    </>
  );
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
