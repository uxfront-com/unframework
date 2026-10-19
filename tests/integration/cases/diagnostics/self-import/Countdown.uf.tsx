// UF1203 self-import: a component that imports its own module to render itself.
import Again from "./Countdown.uf.tsx";

export default function Countdown({ from }: { from: number }) {
  return (
    <div class="level">
      <span>{from}</span>
      {from > 0 ? <Again from={from - 1} /> : <strong>Liftoff</strong>}
    </div>
  );
}
