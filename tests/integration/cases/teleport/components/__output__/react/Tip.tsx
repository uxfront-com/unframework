import { subscribeNothing } from "./_unframework/subscribeNothing";
import { teleport } from "./_unframework/teleport";
import { useSyncExternalStore } from "react";

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
