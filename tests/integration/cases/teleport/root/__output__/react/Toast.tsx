import { subscribeNothing } from "./_unframework/subscribeNothing";
import { teleport } from "./_unframework/teleport";
import { useSyncExternalStore } from "react";
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
