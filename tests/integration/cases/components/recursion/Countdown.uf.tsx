// Renders itself until it reaches zero: the recursion ends under a condition (ADR-0053).
export default function Countdown({ from }: { from: number }) {
  return (
    <div class="level">
      <span>{from}</span>
      {from > 0 ? <Countdown from={from - 1} /> : <strong>Liftoff</strong>}
    </div>
  );
}
