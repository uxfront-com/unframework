// UF1205 import-cycle: `Ping` and `Pong` import each other, so neither module can load before the
// other: Angular's standalone components fail to load without `forwardRef` (ADR-0053, ADR-0071).
// The project graph reports the import that closes the cycle in each module.
import Pong from "./Pong.uf.tsx";

export default function Ping({ count }: { count: number }) {
  return <span>{count > 0 ? <Pong count={count - 1} /> : "Ping"}</span>;
}
