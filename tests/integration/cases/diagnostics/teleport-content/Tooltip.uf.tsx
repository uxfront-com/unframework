// UF3054 teleport-content: the content of `<Teleport>` is exactly one element, so text, a second
// element and a component as the content are rejected.
import { Teleport } from "@uxfront/unframework";

function Hint() {
  return <p>Hint</p>;
}

export default function Tooltip() {
  return (
    <section>
      <Teleport to="body">Saved</Teleport>
      <Teleport to="body">
        <p>First</p>
        <p>Second</p>
      </Teleport>
      <Teleport to="body">
        <Hint />
      </Teleport>
    </section>
  );
}
