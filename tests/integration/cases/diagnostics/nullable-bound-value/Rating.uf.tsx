// UF1002 unsupported-syntax: a bound `value` that may be null on a <meter>, which Svelte and
// Solid render as "0" or "null" while the other targets leave it out.
export interface RatingProps {
  stars: number | null;
}

export default function Rating({ stars }: RatingProps) {
  return (
    <meter min="0" max="5" value={stars} aria-label="Rating">
      {stars ?? "No"} stars
    </meter>
  );
}
