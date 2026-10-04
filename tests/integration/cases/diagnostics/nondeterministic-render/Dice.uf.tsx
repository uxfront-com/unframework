// UF3019 nondeterministic-render: `Math.random()` renders differently on the server and the client.
export default function Dice() {
  return <p>You rolled {Math.floor(Math.random() * 6) + 1}.</p>;
}
