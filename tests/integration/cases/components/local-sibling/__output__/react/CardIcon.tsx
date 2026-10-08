export function CardIcon({ symbol }: { symbol: string }) {
  return (
    <span className="icon" aria-hidden="true">
      {symbol}
    </span>
  );
}
