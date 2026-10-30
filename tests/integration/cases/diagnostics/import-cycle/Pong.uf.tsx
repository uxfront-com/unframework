// The other half of the cycle: it renders `Ping` back.
import Ping from "./Ping.uf.tsx";

export default function Pong({ count }: { count: number }) {
  return <span>{count > 0 ? <Ping count={count - 1} /> : "Pong"}</span>;
}
