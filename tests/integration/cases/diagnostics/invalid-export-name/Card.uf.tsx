// UF1103 invalid-export-name: a component exported under a name that is not an identifier.
function Card() {
  return <p class="card">A card</p>;
}

export { Card as "info card", Card as default };
