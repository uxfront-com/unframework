// UF3057 transition-child: `<Transition>` holds one element, or one conditional of elements, so
// two elements, text and a component as its child are rejected.
import { Transition } from "@uxfront/unframework";

function Hint() {
  return <p>Hint</p>;
}

export default function Disclosure() {
  return (
    <section>
      <Transition>
        <p>First</p>
        <p>Second</p>
      </Transition>
      <Transition>Saved</Transition>
      <Transition>
        <Hint />
      </Transition>
    </section>
  );
}
