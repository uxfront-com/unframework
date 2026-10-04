// UF1104 component-name-collision: two components whose names differ only in case.
export function Card() {
  return <p>Card</p>;
}

export function CARD() {
  return <p>Shouting card</p>;
}
