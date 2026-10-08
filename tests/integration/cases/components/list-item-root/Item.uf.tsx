// Its root is an <li>, which belongs in a list: the parent's compile checks where it sits.
export default function Item({ label }: { label: string }) {
  return <li class="item">{label}</li>;
}
