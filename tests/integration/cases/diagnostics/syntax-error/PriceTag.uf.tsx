// UF1001 syntax-error: JSX text cannot hold a raw `>`; the likely fix writes the reference `&gt;`.
export default function PriceTag() {
  return <p>Orders > 50 EUR ship free</p>;
}
