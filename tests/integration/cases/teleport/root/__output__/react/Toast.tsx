import { type ReactNode, type ReactPortal, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import "./Toast.uf.tsx.css";

export interface ToastProps {
  message: string;
}

export default function Toast({ message }: ToastProps) {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  return (
    <>
      {mounted
        ? teleport(
            <div data-teleported="true" className="toast" role="alert" data-uf-416dbabb="">
              <p data-uf-416dbabb="">{message}</p>
            </div>,
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
