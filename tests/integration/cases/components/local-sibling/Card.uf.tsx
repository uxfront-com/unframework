// `CardIcon` is not exported: it is a sibling file of `Card`'s in each output (plan §4.1).
function CardIcon({ symbol }: { symbol: string }) {
  return (
    <span class="icon" aria-hidden="true">
      {symbol}
    </span>
  );
}

export default function Card({ title }: { title: string }) {
  return (
    <div class="card">
      <CardIcon symbol="+" />
      <h3>{title}</h3>
      <CardIcon symbol="-" />
    </div>
  );
}
