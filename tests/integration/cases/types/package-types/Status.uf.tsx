import type { TimeInterval } from "rxjs";

import type { Labelled } from "./types";

// Members a package declares, `value` and `interval` from rxjs's generic `TimeInterval<T>`, beside
// one a `.ts` module declares.
type StatusProps = TimeInterval<string> & Labelled;

export default function Status({ value, interval, label }: StatusProps) {
  return (
    <p>
      {label}: {value} after {interval} ms
    </p>
  );
}
